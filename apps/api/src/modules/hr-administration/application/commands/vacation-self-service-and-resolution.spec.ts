import { ForbiddenException } from '@nestjs/common';
import type { Employee, LeaveRequest, VacationRequest } from '@prisma/client';
import {
  InvalidGrantedDaysError,
  VacationAlreadyResolvedError,
  VacationNotFoundError,
} from '../../domain/hr-administration-errors';
import {
  BRANCH_ID,
  COMPANY_ID,
  FixedClock,
  ORG_ID,
  buildAudit,
  buildEmployee,
  buildMatrixAuth,
  buildOutbox,
  buildTransactionManager,
  buildWorkContext,
} from '../../testing/hr-administration-test-fixtures';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import type { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import type { VacationRepositoryPort, VacationWithEmployeeScope } from '../ports/vacation-repository.port';
import type { LeaveRepositoryPort } from '../ports/leave-repository.port';
import { ResolveVacationCommand } from './resolve-vacation.command';
import { ResolveVacationHandler } from './resolve-vacation.handler';
import { RequestVacationCommand } from './request-vacation.command';
import { RequestVacationHandler } from './request-vacation.handler';
import { RequestLeaveCommand } from './request-leave.command';
import { RequestLeaveHandler } from './request-leave.handler';

describe('R4: Autoservicio de Vacaciones / Permisos y Resolución Gerencial', () => {
  let employee: Employee;
  let access: HrAdministrationAccessService;
  let tm: ReturnType<typeof buildTransactionManager>;
  let audit: ReturnType<typeof buildAudit>;
  let outbox: ReturnType<typeof buildOutbox>;
  let clock: FixedClock;

  beforeEach(() => {
    employee = buildEmployee();
    clock = new FixedClock(new Date('2026-10-23T10:00:00.000Z'));
    tm = buildTransactionManager();
    audit = buildAudit();
    outbox = buildOutbox();
  });

  describe('ResolveVacationHandler (Gerencia)', () => {
    let vacationsRepo: jest.Mocked<VacationRepositoryPort>;
    let existingVacation: VacationWithEmployeeScope;

    beforeEach(() => {
      access = new HrAdministrationAccessService(buildWorkContext('GERENCIA'), buildMatrixAuth());
      existingVacation = {
        id: 'vac-1',
        employeeId: employee.id,
        operatingCompanyId: COMPANY_ID,
        areaId: employee.areaId,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-11-15T00:00:00.000Z'), // 15 días
        status: 'SOLICITADA',
        requestedAt: new Date('2026-10-20T10:00:00.000Z'),
        approvedById: null,
        approvedAt: null,
        notes: 'Vacaciones familiares',
        grantedDays: null,
        originalStartDate: null,
        originalEndDate: null,
        rescheduleCount: 0,
        statusReason: null,
        statusChangedAt: null,
        statusChangedById: null,
        createdAt: new Date('2026-10-20T10:00:00.000Z'),
        updatedAt: new Date('2026-10-20T10:00:00.000Z'),
        employee: {
          fullName: employee.fullName,
          areaName: employee.areaName,
          areaId: employee.areaId,
          status: 'ACTIVO',
          organizationId: ORG_ID,
          operatingCompanyId: COMPANY_ID,
          branchId: BRANCH_ID,
        },
      };

      vacationsRepo = {
        findById: jest.fn().mockResolvedValue(existingVacation),
        findActiveByCompany: jest.fn().mockResolvedValue([]),
        findActiveByArea: jest.fn().mockResolvedValue([]),
        findCalendar: jest.fn().mockResolvedValue([]),
        findByEmployee: jest.fn().mockResolvedValue([existingVacation]),
        create: jest.fn(),
        reschedule: jest.fn(),
        cancel: jest.fn(),
        resolve: jest.fn().mockImplementation(async (id, data) => ({
          ...existingVacation,
          ...data,
          id,
        })),
      };
    });

    it('Gerencia aprueba vacaciones concediendo menos días de los solicitados (grantedDays)', async () => {
      const handler = new ResolveVacationHandler(access, vacationsRepo, tm, clock, audit);
      const result = await handler.execute(
        new ResolveVacationCommand('user-gerencia', 'vac-1', 'PROGRAMADA', 10, 'Aprobado por 10 días'),
      );

      expect(result.status).toBe('PROGRAMADA');
      expect(result.grantedDays).toBe(10);
      expect(vacationsRepo.resolve).toHaveBeenCalledWith(
        'vac-1',
        expect.objectContaining({
          status: 'PROGRAMADA',
          grantedDays: 10,
          approvedById: 'user-gerencia',
        }),
        expect.anything(),
      );
      expect(audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'VACATION_RESOLVED' }),
        expect.anything(),
      );
    });

    it('lanza InvalidGrantedDaysError si grantedDays supera los días solicitados o es menor a 1', async () => {
      const handler = new ResolveVacationHandler(access, vacationsRepo, tm, clock, audit);

      await expect(
        handler.execute(new ResolveVacationCommand('user-gerencia', 'vac-1', 'PROGRAMADA', 20)),
      ).rejects.toThrow(InvalidGrantedDaysError);

      await expect(
        handler.execute(new ResolveVacationCommand('user-gerencia', 'vac-1', 'PROGRAMADA', 0)),
      ).rejects.toThrow(InvalidGrantedDaysError);
    });

    it('Gerencia rechaza vacaciones con motivo obligatorio', async () => {
      const handler = new ResolveVacationHandler(access, vacationsRepo, tm, clock, audit);
      const result = await handler.execute(
        new ResolveVacationCommand('user-gerencia', 'vac-1', 'CANCELADA', null, 'Cierre contable en esas fechas'),
      );

      expect(result.status).toBe('CANCELADA');
      expect(vacationsRepo.resolve).toHaveBeenCalledWith(
        'vac-1',
        expect.objectContaining({
          status: 'CANCELADA',
          statusReason: 'Cierre contable en esas fechas',
        }),
        expect.anything(),
      );
    });
  });

  describe('RequestVacationHandler (Autoservicio)', () => {
    let vacationsRepo: jest.Mocked<VacationRepositoryPort>;
    let employeesRepo: jest.Mocked<EmployeeRepositoryPort>;

    beforeEach(() => {
      employee.firebaseUid = 'user-collab-1';
      employeesRepo = {
        findById: jest.fn().mockResolvedValue(employee),
      } as unknown as jest.Mocked<EmployeeRepositoryPort>;

      vacationsRepo = {
        create: jest.fn().mockImplementation(async (data) => ({
          id: 'new-vac-1',
          ...data,
          requestedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          approvedById: null,
          approvedAt: null,
          grantedDays: null,
          originalStartDate: null,
          originalEndDate: null,
          rescheduleCount: 0,
          statusReason: null,
          statusChangedAt: null,
          statusChangedById: null,
        })),
      } as unknown as jest.Mocked<VacationRepositoryPort>;
    });

    it('colaborador solicita sus propias vacaciones y crea en SOLICITADA emitiendo VacacionSolicitada.v1', async () => {
      access = new HrAdministrationAccessService(buildWorkContext('CAMPO'), buildMatrixAuth());
      const workCtx = buildWorkContext('CAMPO');
      const handler = new RequestVacationHandler(access, workCtx, vacationsRepo, employeesRepo, tm, audit, outbox);

      const result = await handler.execute(
        new RequestVacationCommand(
          'user-collab-1',
          employee.id,
          new Date('2026-11-10T00:00:00.000Z'),
          new Date('2026-11-20T00:00:00.000Z'),
          'Solicitud personal',
        ),
      );

      expect(result.status).toBe('SOLICITADA');
      expect(outbox.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'VacacionSolicitada.v1',
          aggregateId: 'new-vac-1',
          payload: expect.objectContaining({
            employeeId: employee.id,
            actorUserId: 'user-collab-1',
          }),
        }),
        expect.anything(),
      );
    });
  });

  describe('RequestLeaveHandler (Autoservicio y Outbox)', () => {
    let leavesRepo: jest.Mocked<LeaveRepositoryPort>;
    let employeesRepo: jest.Mocked<EmployeeRepositoryPort>;

    beforeEach(() => {
      employee.firebaseUid = 'user-collab-1';
      employeesRepo = {
        findById: jest.fn().mockResolvedValue(employee),
      } as unknown as jest.Mocked<EmployeeRepositoryPort>;

      leavesRepo = {
        create: jest.fn().mockImplementation(async (data) => ({
          id: 'new-leave-1',
          ...data,
          status: 'SOLICITADO',
          authorizedById: null,
          authorizedByName: null,
          resolutionNotes: null,
          resolvedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      } as unknown as jest.Mocked<LeaveRepositoryPort>;
    });

    it('colaborador solicita su propio permiso y emite PermisoSolicitado.v1 al outbox', async () => {
      access = new HrAdministrationAccessService(buildWorkContext('CAMPO'), buildMatrixAuth());
      const handler = new RequestLeaveHandler(access, leavesRepo, employeesRepo, tm, audit, outbox);

      const result = await handler.execute(
        new RequestLeaveCommand(
          'user-collab-1',
          employee.id,
          'PERMISO_HORAS',
          new Date('2026-10-25T00:00:00.000Z'),
          'Trámite personal',
        ),
      );

      expect(result.status).toBe('SOLICITADO');
      expect(outbox.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PermisoSolicitado.v1',
          aggregateId: 'new-leave-1',
          payload: expect.objectContaining({
            employeeId: employee.id,
            actorUserId: 'user-collab-1',
          }),
        }),
        expect.anything(),
      );
    });
  });
});
