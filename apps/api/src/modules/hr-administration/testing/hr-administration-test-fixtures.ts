import { ForbiddenException } from '@nestjs/common';
import type { Employee, Prisma } from '@prisma/client';
import { Prisma as PrismaRuntime } from '@prisma/client';
import { WorkContextAuthorizationService } from '../../users/application/services/work-context-authorization.service';
import type { WorkerRole } from '../../users/domain/worker-role';
import { MatrixAuthorizationService } from '../../authorization/matrix-authorization.service';
import {
  assertHrAdministrationRoleAllowed,
  HrAdministrationAction,
} from '../application/policies/hr-administration-role-policy';
import { roleKeyOfTestRoleId, testRole } from '../../users/testing/role-fixtures';
import { TransactionManagerPort } from '../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../common/application/ports/clock.port';
import type { AuditEventRepositoryPort } from '../../audit/application/ports/audit-event-repository.port';
import type { OutboxEventRepositoryPort } from '../../outbox/application/ports/outbox-event-repository.port';
import type { UserDisplayNamePort } from '../application/ports/user-display-name.port';

export const ORG_ID = 'org-hr-1';
export const COMPANY_ID = 'company-hr-1';
export const BRANCH_ID = 'branch-hr-1';
export const HR_SCOPE = {
  organizationId: ORG_ID,
  operatingCompanyId: COMPANY_ID,
  branchId: BRANCH_ID,
};

export function buildWorkContext(
  role: WorkerRole | 'forbidden' = 'RRHH',
): jest.Mocked<WorkContextAuthorizationService> {
  return {
    authorize:
      role === 'forbidden'
        ? jest.fn().mockRejectedValue(new ForbiddenException('Asignación de usuario no vigente.'))
        : jest.fn().mockResolvedValue({
            organizationId: ORG_ID,
            companyId: COMPANY_ID,
            branchId: BRANCH_ID,
            ...testRole(role),
          }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
}

export function buildMatrixAuth(): jest.Mocked<MatrixAuthorizationService> {
  return {
    isAllowed: jest.fn().mockImplementation(async (_orgId: string, role: string, module: string, action: string) => {
      if (module === 'HR_ADMINISTRATION') {
        try {
          assertHrAdministrationRoleAllowed(roleKeyOfTestRoleId(role), action as HrAdministrationAction);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }),
    assertAllowed: jest.fn().mockImplementation(async (_orgId: string, role: string, module: string, action: string) => {
      if (module === 'HR_ADMINISTRATION') {
        assertHrAdministrationRoleAllowed(roleKeyOfTestRoleId(role), action as HrAdministrationAction);
      }
    }),
  } as unknown as jest.Mocked<MatrixAuthorizationService>;
}

export function buildTransactionManager(): jest.Mocked<TransactionManagerPort> & { tx: Prisma.TransactionClient } {
  const tx = { marker: 'tx' } as unknown as Prisma.TransactionClient;
  return {
    tx,
    run: jest.fn().mockImplementation(async (work: (t: Prisma.TransactionClient) => Promise<unknown>) => work(tx)),
  } as unknown as jest.Mocked<TransactionManagerPort> & { tx: Prisma.TransactionClient };
}

export class FixedClock extends ClockPort {
  constructor(private instant: Date = new Date('2026-10-09T08:00:00Z')) {
    super();
  }
  now(): Date {
    return new Date(this.instant.getTime());
  }
  set(instant: Date): void {
    this.instant = instant;
  }
}

export function buildAudit(): jest.Mocked<AuditEventRepositoryPort> {
  return {
    recordHrAdministrationEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditEventRepositoryPort>;
}

export function buildOutbox(): jest.Mocked<OutboxEventRepositoryPort> {
  return { publish: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
}

export function buildDisplayNames(name: string | null = 'Fiorella'): jest.Mocked<UserDisplayNamePort> {
  return { findDisplayName: jest.fn().mockResolvedValue(name) } as unknown as jest.Mocked<UserDisplayNamePort>;
}

export function buildEmployee(over: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    organizationId: ORG_ID,
    operatingCompanyId: COMPANY_ID,
    branchId: BRANCH_ID,
    candidateId: null,
    documentType: 'DNI',
    documentNumber: '45678912',
    fullName: 'Carlos Perez',
    email: null,
    phone: null,
    areaId: 'OPERACIONES',
    areaName: 'Operaciones y Logística',
    jobTitle: 'Auxiliar de campo',
    status: 'PLANILLA',
    hireDate: new Date('2026-01-05T00:00:00Z'),
    probationEvaluatedAt: null,
    probationPassed: true,
    payrollStartedAt: null,
    terminatedAt: null,
    terminationReason: null,
    terminationNoticeDays: null,
    terminationNotes: null,
    fieldTripLateCount: 0,
    isFieldTripObserved: false,
    baseSalary: new PrismaRuntime.Decimal(3000),
    version: 1,
    createdAt: new Date('2026-01-05T00:00:00Z'),
    updatedAt: new Date('2026-01-05T00:00:00Z'),
    ...over,
  };
}
