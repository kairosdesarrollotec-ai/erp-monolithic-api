/// <reference types="jest" />
import { AuditEventRepositoryPort } from '../../audit/application/ports/audit-event-repository.port';
import { MatrixAuthorizationService } from '../../authorization/matrix-authorization.service';
import { WorkContextAuthorizationService } from '../../users/application/services/work-context-authorization.service';
import type { WorkerRole } from '../../users/domain/worker-role';
import { roleKeyOfTestRoleId, testRole } from '../../users/testing/role-fixtures';
import { isPaymentRoleAllowed, PaymentAction } from '../application/policies/payment-role-policy';
import { DepositAggregate, AdjustmentRecord, DepositRepositoryPort } from '../application/ports/deposit-repository.port';
import { PaymentAccessService } from '../application/services/payment-access.service';
import type { DepositStatus } from '../domain/deposit-status';
import type { AdjustmentType } from '../domain/adjustment-type';

export function buildAdjustment(overrides: Partial<AdjustmentRecord & { type: AdjustmentType }> = {}): AdjustmentRecord {
  return {
    id: 'adj-1',
    depositId: 'dep-1',
    type: 'DISCOUNT',
    amount: 100,
    reason: 'Dano estetico',
    authorizedBy: 'uid-1',
    createdAt: new Date('2026-10-11T10:00:00.000Z'),
    ...overrides,
  };
}

export function buildDeposit(overrides: Partial<DepositAggregate & { adjustments: Partial<AdjustmentRecord & { type: AdjustmentType }>[] }> = {}): DepositAggregate {
  const { adjustments: rawAdj = [], ...rest } = overrides;
  const adjustments = rawAdj.map((a) => buildAdjustment(a));
  return {
    id: 'dep-1',
    rentalId: 'rent-1',
    rentalCode: 'ALQ-1187',
    clientName: 'Juan Rios Vega',
    vehiclePlate: 'ABC-123',
    originalAmount: 500,
    currency: 'PEN',
    status: 'HELD' as DepositStatus,
    closedAt: null,
    closureNotes: null,
    createdAt: new Date('2026-10-11T08:00:00.000Z'),
    updatedAt: new Date('2026-10-11T08:00:00.000Z'),
    adjustments,
    ...rest,
  };
}

export interface PaymentTestDeps {
  workContext: jest.Mocked<WorkContextAuthorizationService>;
  matrixAuth: jest.Mocked<MatrixAuthorizationService>;
  access: PaymentAccessService;
  deposits: jest.Mocked<DepositRepositoryPort>;
  auditRepository: jest.Mocked<AuditEventRepositoryPort>;
}

export function buildDeps(options: { role?: WorkerRole } = {}): PaymentTestDeps {
  const role = options.role ?? 'GERENCIA';
  const workContext = {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'comp-1', branchId: 'branch-1', ...testRole(role) }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;

  const matrixAuth = {
    assertAllowed: jest.fn(async (_org: string, roleId: string, module: string, action: string) => {
      const r = roleKeyOfTestRoleId(roleId);
      if (module !== 'PAYMENT' || !isPaymentRoleAllowed(r, action as PaymentAction)) {
        const { ForbiddenException } = await import('@nestjs/common');
        throw new ForbiddenException({ code: 'ROLE_NOT_ALLOWED', detail: `El rol ${r} no tiene permiso para ${module}.${action}` });
      }
    }),
  } as unknown as jest.Mocked<MatrixAuthorizationService>;

  const deposits: jest.Mocked<DepositRepositoryPort> = {
    findById: jest.fn(),
    findByRentalId: jest.fn(),
    listByScope: jest.fn(),
    updateStatus: jest.fn(),
    addAdjustment: jest.fn(),
  };

  const auditRepository: jest.Mocked<AuditEventRepositoryPort> = {
    recordLoginAttempt: jest.fn(),
    recordWorkContextSelection: jest.fn(),
    recordReservationEvent: jest.fn(),
    recordInquiryEvent: jest.fn(),
    recordAdminEvent: jest.fn(),
    recordRentalEvent: jest.fn(),
    recordIncidentEvent: jest.fn(),
    recordRecruitmentEvent: jest.fn(),
    recordHrAdministrationEvent: jest.fn(),
    recordPaymentEvent: jest.fn().mockResolvedValue(undefined),
    recordFleetEvent: jest.fn().mockResolvedValue(undefined),
  };

  return {
    workContext,
    matrixAuth,
    access: new PaymentAccessService(workContext, matrixAuth),
    deposits,
    auditRepository,
  };
}
