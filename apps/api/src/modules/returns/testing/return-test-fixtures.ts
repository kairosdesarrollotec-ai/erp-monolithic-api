/// <reference types="jest" />
import type { Prisma } from '@prisma/client';
import { ClockPort } from '../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../outbox/application/ports/outbox-event-repository.port';
import { FleetVehicleRepositoryPort } from '../../fleet/application/ports/fleet-vehicle-repository.port';
import { RentalRecord, RentalRepositoryPort } from '../../rentals/application/ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../authorization/matrix-authorization.service';
import type { WorkerRole } from '../../users/domain/worker-role';
import { CustomerRiskStatus, escalateCustomerRiskStatus } from '../domain/customer-risk-status';
import { ReturnAccessService } from '../application/services/return-access.service';
import { assertReturnRoleAllowed, ReturnAction } from '../application/policies/return-role-policy';
import { roleKeyOfTestRoleId } from '../../users/testing/role-fixtures';
import { ReturnDepositSettlementPort } from '../application/ports/return-deposit-settlement.port';
import { ReturnCustomerRiskPort } from '../application/ports/return-customer-risk.port';
import { ReturnOpenIncidentsPort } from '../application/ports/return-open-incidents.port';
import {
  ImmobilizationChargeRecord,
  ReturnDamageRecord,
  ReturnRecord,
  ReturnRepositoryPort,
  UpdateReturnInput,
} from '../application/ports/return-repository.port';
import { testRole } from '../../users/testing/role-fixtures';

export const FIXED_NOW = new Date('2026-10-05T12:00:00.000Z');

export const TEST_SCOPE = {
  organizationId: 'org-1',
  operatingCompanyId: 'comp-1',
  branchId: 'branch-1',
} as const;

export const fakeTx = {} as Prisma.TransactionClient;

export function buildReturnRecord(overrides: Partial<ReturnRecord> = {}): ReturnRecord {
  return {
    id: 'ret-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    rentalId: 'rent-1',
    vehicleId: 'veh-1',
    customerId: 'cust-1',
    vehiclePlate: 'ABC-123',
    customerName: 'Juan Perez',
    status: 'PROGRAMADA',
    custodyHolder: 'CLIENTE',
    customerPresent: true,
    mileageAtReturn: null,
    fuelLevelAtReturn: null,
    alcoholTestResult: null,
    alcoholTestNotes: null,
    alcoholEscalationDecision: null,
    alcoholEscalationMarkedRed: null,
    alcoholEscalationNotes: null,
    alcoholEscalationDecidedById: null,
    alcoholEscalationDecidedAt: null,
    responsibilitySignerName: null,
    responsibilitySignerIsHolder: null,
    responsibilitySignerRelation: null,
    responsibilitySignatureData: null,
    responsibilitySignedAt: null,
    vehicleDailyRate: 120,
    scheduledAt: new Date('2026-10-05T10:00:00.000Z'),
    receivedAt: null,
    inspectedAt: null,
    closedAt: null,
    finalSettlementAmount: null,
    notes: null,
    createdAt: new Date('2026-10-05T09:00:00.000Z'),
    createdBy: 'uid-1',
    updatedAt: new Date('2026-10-05T09:00:00.000Z'),
    updatedBy: 'uid-1',
    version: 3,
    damages: [],
    immobilizationCharges: [],
    ...overrides,
  };
}

export function buildDamage(overrides: Partial<ReturnDamageRecord> = {}): ReturnDamageRecord {
  return {
    id: 'dmg-1',
    returnId: 'ret-1',
    origin: 'AESTHETIC',
    severity: 'LEVE',
    damagedZone: 'CAPOT',
    estimatedAmount: 200,
    externalReportReference: null,
    description: null,
    createdAt: new Date('2026-10-05T11:00:00.000Z'),
    ...overrides,
  };
}

export function buildTechnicalDamage(overrides: Partial<ReturnDamageRecord> = {}): ReturnDamageRecord {
  return buildDamage({
    id: 'dmg-tech',
    origin: 'TECHNICAL',
    severity: 'MODERADO',
    damagedZone: null,
    estimatedAmount: 850,
    externalReportReference: 'INFORME-MOTRIX-2026-0847',
    ...overrides,
  });
}

export function buildCharge(overrides: Partial<ImmobilizationChargeRecord> = {}): ImmobilizationChargeRecord {
  return {
    id: 'chg-1',
    returnId: 'ret-1',
    damageId: 'dmg-tech',
    daysCharged: 1,
    dailyRate: 100,
    totalAmount: 100,
    notes: null,
    createdAt: new Date('2026-10-05T11:30:00.000Z'),
    ...overrides,
  };
}

export function buildRentalRecord(overrides: Partial<RentalRecord> = {}): RentalRecord {
  return {
    id: 'rent-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Juan Perez',
    customerDocNumber: '12345678',
    vehicleId: 'veh-1',
    vehiclePlate: 'ABC-123',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Corolla',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'ACTIVE',
    startAt: new Date('2026-10-01T09:00:00.000Z'),
    expectedEndAt: new Date('2026-10-05T09:00:00.000Z'),
    alcoholTestResult: null,
    createdAt: new Date('2026-09-30T00:00:00.000Z'),
    createdBy: 'uid-1',
    updatedAt: new Date('2026-09-30T00:00:00.000Z'),
    updatedBy: 'uid-1',
    version: 7,
    deposit: {
      id: 'dep-1',
      rentalId: 'rent-1',
      originalAmount: '500.00',
      currency: 'PEN',
      status: 'HELD',
      createdAt: new Date('2026-10-01T09:00:00.000Z'),
    },
    ...overrides,
  };
}

/** Aplica un UpdateReturnInput sobre un registro como lo haría el repositorio (campos definidos + version+1). */
export function applyUpdate(base: ReturnRecord, input: UpdateReturnInput): ReturnRecord {
  const fields: Record<string, unknown> = { ...input };
  for (const key of ['id', 'scope', 'expectedVersion', 'updatedBy']) {
    delete fields[key];
  }
  const defined = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  return { ...base, ...defined, updatedBy: input.updatedBy, version: input.expectedVersion + 1 };
}

export class FixedClock extends ClockPort {
  constructor(private readonly instant: Date = FIXED_NOW) {
    super();
  }
  now(): Date {
    return new Date(this.instant);
  }
}

export interface HandlerTestDeps {
  access: ReturnAccessService;
  workContext: jest.Mocked<WorkContextAuthorizationService>;
  returns: jest.Mocked<ReturnRepositoryPort>;
  rentals: jest.Mocked<RentalRepositoryPort>;
  fleetVehicles: jest.Mocked<FleetVehicleRepositoryPort>;
  settlement: jest.Mocked<ReturnDepositSettlementPort>;
  customerRisk: jest.Mocked<ReturnCustomerRiskPort>;
  openIncidents: jest.Mocked<ReturnOpenIncidentsPort>;
  transactionManager: jest.Mocked<TransactionManagerPort>;
  clock: ClockPort;
  auditRepository: jest.Mocked<AuditEventRepositoryPort>;
  outboxRepository: jest.Mocked<OutboxEventRepositoryPort>;
}

export function buildDeps(
  options: { role?: WorkerRole; now?: Date; customerRisk?: CustomerRiskStatus } = {},
): HandlerTestDeps {
  const workContext = {
    authorize: jest.fn().mockResolvedValue({
      organizationId: 'org-1',
      companyId: 'comp-1',
      branchId: 'branch-1',
      ...testRole(options.role ?? 'GERENCIA'),
    }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;

  const matrixAuth = {
    assertAllowed: jest.fn(async (_org: string, roleId: string, module: string, action: string) => {
      const r = roleKeyOfTestRoleId(roleId);
      try {
        if (module === 'RETURN') {
          assertReturnRoleAllowed(r, action as ReturnAction);
        }
      } catch {
        const { ForbiddenException } = await import('@nestjs/common');
        throw new ForbiddenException({ code: 'ROLE_NOT_ALLOWED', detail: `El rol ${r} no tiene permiso para ${module}.${action}` });
      }
    }),
  } as unknown as jest.Mocked<MatrixAuthorizationService>;

  const returns: jest.Mocked<ReturnRepositoryPort> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByRentalId: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
    addDamage: jest.fn(),
    addImmobilizationCharge: jest.fn(),
    addEvidence: jest.fn(),
    listEvidences: jest.fn(),
    countEvidenceByType: jest.fn(),
  };

  const rentals = {
    findById: jest.fn(),
    transitionStatus: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<RentalRepositoryPort>;

  const fleetVehicles = {
    updateStatus: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<FleetVehicleRepositoryPort>;

  const settlement: jest.Mocked<ReturnDepositSettlementPort> = {
    recordImmobilizationCharge: jest.fn().mockResolvedValue({ applied: true }),
    settleDeposit: jest.fn().mockResolvedValue({ applied: true }),
  };

  /** Mock con semáforo en memoria: nunca degrada (misma regla de dominio que la persistencia real). */
  let riskState: CustomerRiskStatus = options.customerRisk ?? 'NORMAL';
  const customerRisk: jest.Mocked<ReturnCustomerRiskPort> = {
     
    escalate: jest.fn(async (input, _tx) => {
      const previous = riskState;
      riskState = escalateCustomerRiskStatus(riskState, input.target);
      return { previous, current: riskState };
    }),
  };

  /** Por defecto el expediente no tiene incidencias abiertas en el modulo Incidencias. */
  const openIncidents: jest.Mocked<ReturnOpenIncidentsPort> = {
    findOpenIncidentIds: jest.fn().mockResolvedValue([]),
  };

  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: (tx: Prisma.TransactionClient) => Promise<unknown>) => work(fakeTx)) as never,
  };

  const auditRepository: jest.Mocked<AuditEventRepositoryPort> = {
    recordLoginAttempt: jest.fn(),
    recordWorkContextSelection: jest.fn(),
    recordReservationEvent: jest.fn(),
    recordInquiryEvent: jest.fn(),
    recordAdminEvent: jest.fn(),
    recordRentalEvent: jest.fn().mockResolvedValue(undefined),
    recordIncidentEvent: jest.fn().mockResolvedValue(undefined),
    recordRecruitmentEvent: jest.fn().mockResolvedValue(undefined),
  };

  const outboxRepository: jest.Mocked<OutboxEventRepositoryPort> = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  return {
    access: new ReturnAccessService(workContext, matrixAuth),
    workContext,
    returns,
    rentals,
    fleetVehicles,
    settlement,
    customerRisk,
    openIncidents,
    transactionManager,
    clock: new FixedClock(options.now ?? FIXED_NOW),
    auditRepository,
    outboxRepository,
  };
}
