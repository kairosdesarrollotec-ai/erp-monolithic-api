import { Injectable } from '@nestjs/common';
import { Prisma, type VacationRequest } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { VacationRepositoryPort } from '../ports/vacation-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import {
  EmployeeNotFoundError,
  EmployeeTerminatedError,
  InvalidDateRangeError,
} from '../../domain/hr-administration-errors';
import { validateVacationAreaCapacity } from '../../domain/hr-administration-rules';
import { ScheduleVacationCommand } from './schedule-vacation.command';

/**
 * ADP-P09..10 / BR-ADP-002: programa vacaciones verificando el calendario del ÁREA (máximo 1 persona del área de
 * vacaciones a la vez; no son "2 personas clave"). Prioridad por orden de solicitud: si el rango se superpone con
 * vacaciones ya solicitadas/programadas del área se rechaza con VACATION_OVERLAP; si no, queda PROGRAMADA.
 * Corre en transacción Serializable para que dos solicitudes simultáneas no copen el mismo cupo.
 */
@Injectable()
export class ScheduleVacationHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly vacations: VacationRepositoryPort,
    private readonly employees: EmployeeRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ScheduleVacationCommand): Promise<VacationRequest> {
    const found = await this.employees.findById(command.employeeId);
    if (!found) {
      throw new EmployeeNotFoundError(command.employeeId);
    }

    const { context } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: found.operatingCompanyId,
        branchId: found.branchId,
      },
      'SCHEDULE_VACATION',
    );

    if (command.startDate.getTime() > command.endDate.getTime()) {
      throw new InvalidDateRangeError();
    }

    return this.transactionManager.run(
      async (tx) => {
        const employee = await this.employees.findById(command.employeeId, tx);
        if (!employee) {
          throw new EmployeeNotFoundError(command.employeeId);
        }
        if (employee.status === 'TERMINADO') {
          throw new EmployeeTerminatedError(employee.id);
        }

        const activeInArea = await this.vacations.findActiveByArea(employee.operatingCompanyId, employee.areaId, tx);

        validateVacationAreaCapacity(
          activeInArea.map((v) => ({
            id: v.id,
            employeeId: v.employeeId,
            areaId: v.areaId,
            startDate: v.startDate,
            endDate: v.endDate,
            status: v.status,
            requestedAt: v.requestedAt,
          })),
          {
            employeeId: employee.id,
            areaId: employee.areaId,
            startDate: command.startDate,
            endDate: command.endDate,
            status: 'SOLICITADA',
          },
          employee.areaName,
        );

        const now = this.clock.now();
        const created = await this.vacations.create(
          {
            employeeId: employee.id,
            operatingCompanyId: employee.operatingCompanyId,
            areaId: employee.areaId,
            startDate: command.startDate,
            endDate: command.endDate,
            notes: command.notes?.trim() || null,
            status: 'PROGRAMADA',
            approvedById: command.firebaseUid,
            approvedAt: now,
          },
          tx,
        );

        await this.auditRepository.recordHrAdministrationEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            entityType: 'vacation',
            entityId: created.id,
            action: 'VACATION_SCHEDULED',
            changes: {
              employeeId: created.employeeId,
              areaId: created.areaId,
              startDate: created.startDate,
              endDate: created.endDate,
              status: created.status,
            },
          },
          tx,
        );

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
