import { ForbiddenException } from '@nestjs/common';
import { DomainNotFoundError } from '../../../common/domain/domain-errors';
import {
  EmployeeNotFoundError,
  FieldTripNotFoundError,
  LeaveNotFoundError,
} from '../domain/hr-administration-errors';
import {
  BRANCH_ID,
  COMPANY_ID,
  FixedClock,
  ORG_ID,
  HR_SCOPE,
  buildAudit,
  buildDisplayNames,
  buildEmployee,
  buildMatrixAuth,
  buildMemoRepo,
  buildOutbox,
  buildTransactionManager,
} from '../testing/hr-administration-test-fixtures';
import { HrAdministrationAccessService } from './services/hr-administration-access.service';
import { MatrixAuthorizationService } from '../../authorization/matrix-authorization.service';
import { WorkContextAuthorizationService } from '../../users/application/services/work-context-authorization.service';
import { testRole } from '../../users/testing/role-fixtures';
import type { EmployeeRepositoryPort } from './ports/employee-repository.port';
import type { LeaveRepositoryPort } from './ports/leave-repository.port';
import type { FieldTripRepositoryPort } from './ports/field-trip-repository.port';
import type { EmploymentTerminationRepositoryPort } from './ports/employment-termination-repository.port';
import { UpdateEmployeeCommand } from './commands/update-employee.command';
import { UpdateEmployeeHandler } from './commands/update-employee.handler';
import { TerminateEmploymentCommand } from './commands/terminate-employment.command';
import { TerminateEmploymentHandler } from './commands/terminate-employment.handler';
import { RequestLeaveCommand } from './commands/request-leave.command';
import { RequestLeaveHandler } from './commands/request-leave.handler';
import { GetEmployeeDetailHandler } from './queries/get-employee-detail.handler';
import { GetEmployeeDetailQuery } from './queries/get-employee-detail.query';
import { PrismaEmployeeRepository } from '../infrastructure/persistence/prisma-employee.repository';

/**
 * Seguridad multiempresa/multisede en Administración de Personal.
 *
 * Patrón HR: findById (sin scope) + access.authorize con los datos del empleado encontrado.
 * Si el empleado pertenece a otra empresa, authorize rechaza con ForbiddenException.
 * Diferencia con Reclutamiento: allá es 404 vía findScopedById; aquí es 403 vía authorize.
 */

const UID = 'uid-hr-1';
const OTHER_COMPANY_ID = 'company-otra-1';
const OTHER_BRANCH_ID = 'branch-otra-1';
const OTHER_EMP_ID = 'emp-otra-sede';

/** WorkContext que rechaza cualquier acceso a una empresa diferente a la del test. */
function buildCrossCompanyWorkContext(): jest.Mocked<WorkContextAuthorizationService> {
  return {
    authorize: jest.fn().mockImplementation(({ companyId, branchId }: { companyId: string; branchId: string }) => {
      if (companyId !== COMPANY_ID || branchId !== BRANCH_ID) {
        return Promise.reject(new ForbiddenException('Asignación de usuario no vigente.'));
      }
      return Promise.resolve({
        organizationId: ORG_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        ...testRole('RRHH'),
      });
    }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
}

/** Empleado perteneciente a otra empresa/sede. */
function buildOtherCompanyEmployee() {
  return buildEmployee({
    id: OTHER_EMP_ID,
    operatingCompanyId: OTHER_COMPANY_ID,
    branchId: OTHER_BRANCH_ID,
  });
}

function buildAccess(workCtx = buildCrossCompanyWorkContext()) {
  return new HrAdministrationAccessService(workCtx, buildMatrixAuth() as unknown as jest.Mocked<MatrixAuthorizationService>);
}

describe('Administración de Personal — colaboradores de otra empresa/sede son rechazados', () => {
  it('UpdateEmployee: empleado de otra empresa → ForbiddenException', async () => {
    const employees = {
      findById: jest.fn().mockResolvedValue(buildOtherCompanyEmployee()),
      update: jest.fn(),
    } as unknown as jest.Mocked<EmployeeRepositoryPort>;

    const h = new UpdateEmployeeHandler(buildAccess(), employees, buildTransactionManager(), buildAudit());
    await expect(
      h.execute(new UpdateEmployeeCommand(UID, OTHER_EMP_ID, OTHER_COMPANY_ID, OTHER_BRANCH_ID, {})),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(employees.update).not.toHaveBeenCalled();
  });

  it('UpdateEmployee: empleado inexistente → EmployeeNotFoundError', async () => {
    const employees = {
      findById: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    } as unknown as jest.Mocked<EmployeeRepositoryPort>;

    const h = new UpdateEmployeeHandler(buildAccess(), employees, buildTransactionManager(), buildAudit());
    await expect(
      h.execute(new UpdateEmployeeCommand(UID, OTHER_EMP_ID, COMPANY_ID, BRANCH_ID, {})),
    ).rejects.toBeInstanceOf(EmployeeNotFoundError);
    expect(employees.update).not.toHaveBeenCalled();
  });

  it('TerminateEmployment: colaborador de otra empresa → ForbiddenException', async () => {
    const employees = {
      findById: jest.fn().mockResolvedValue(buildOtherCompanyEmployee()),
      terminateEmployment: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<EmployeeRepositoryPort>;
    const terminations = {
      findActiveByEmployeeId: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    } as unknown as jest.Mocked<EmploymentTerminationRepositoryPort>;

    const h = new TerminateEmploymentHandler(
      buildAccess(),
      employees,
      terminations,
      buildTransactionManager(),
      new FixedClock(),
      buildAudit(),
      buildOutbox(),
      buildDisplayNames(),
      buildMemoRepo(),
    );
    await expect(
      h.execute(
        new TerminateEmploymentCommand(
          UID, OTHER_EMP_ID, OTHER_COMPANY_ID, OTHER_BRANCH_ID,
          'RENUNCIA' as never, new Date('2026-10-20'), false, 'ok', null, null,
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(employees.terminateEmployment ?? terminations.create).not.toHaveBeenCalled();
  });

  it('GetEmployeeDetail: colaborador de otra empresa → ForbiddenException', async () => {
    const employees = {
      findById: jest.fn().mockResolvedValue(buildOtherCompanyEmployee()),
      findDetailById: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<EmployeeRepositoryPort>;

    const h = new GetEmployeeDetailHandler(buildAccess(), employees, buildMemoRepo());
    await expect(
      h.execute(new GetEmployeeDetailQuery(UID, OTHER_EMP_ID, OTHER_COMPANY_ID, OTHER_BRANCH_ID)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('los errores de dominio son DomainNotFoundError (404), no Forbidden', () => {
    expect(new EmployeeNotFoundError('x')).toBeInstanceOf(DomainNotFoundError);
    expect(new FieldTripNotFoundError('x')).toBeInstanceOf(DomainNotFoundError);
    expect(new LeaveNotFoundError('x')).toBeInstanceOf(DomainNotFoundError);
  });
});

describe('Repositorios de HR Administration filtran por organización + empresa', () => {
  it('listEmployees incluye organizationId y operatingCompanyId en el where', async () => {
    const prisma = {
      employee: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const repo = new PrismaEmployeeRepository(prisma as never);
    await repo.listEmployees({ organizationId: ORG_ID, companyId: COMPANY_ID });
    const whereArg = prisma.employee.findMany.mock.calls[0][0].where;
    expect(whereArg).toMatchObject({
      organizationId: ORG_ID,
      operatingCompanyId: COMPANY_ID,
    });
  });

  it('findById usa findUnique sin scope (el scope lo impone authorize en el handler)', async () => {
    const prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const repo = new PrismaEmployeeRepository(prisma as never);
    await repo.findById(OTHER_EMP_ID);
    expect(prisma.employee.findUnique).toHaveBeenCalledWith({ where: { id: OTHER_EMP_ID } });
  });
});
