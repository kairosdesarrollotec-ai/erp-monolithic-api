import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { InquiryRecord, InquiryRepositoryPort, QuotationRecord } from '../application/ports/inquiry-repository.port';
import { WorkContextAuthorizationService } from '../../users/application/services/work-context-authorization.service';
import type { WorkerRole } from '../../users/domain/worker-role';
import { TransactionManagerPort } from '../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../common/application/ports/clock.port';
import { MatrixAuthorizationService } from '../../authorization/matrix-authorization.service';
import { assertInquiryRoleAllowed, InquiryAction } from '../application/policies/inquiry-role-policy';
import { assertRentalRoleAllowed, RentalAction } from '../../rentals/application/policies/rental-role-policy';
import { assertReservationRoleAllowed, ReservationAction } from '../../reservations/application/policies/reservation-role-policy';

/** Fixtures compartidas por los tests unitarios del modulo Inquiries (no se usan en runtime). */
export const ORG = 'org-1';
export const COMPANY = 'company-1';
export const BRANCH = 'branch-1';
export const SCOPE = { organizationId: ORG, operatingCompanyId: COMPANY, branchId: BRANCH };

export function buildQuotation(overrides: Partial<QuotationRecord> = {}): QuotationRecord {
  return {
    id: 'quo-1',
    vehicleId: 'veh-1',
    rateCardVersionId: 'RATE-CARD-2026-09',
    destination: 'Vilcashuaman',
    estimatedDays: 3,
    amount: '360.00',
    currency: 'PEN',
    validUntil: new Date('2026-09-26T12:00:00Z'),
    createdAt: new Date('2026-09-23T12:00:00Z'),
    ...overrides,
  };
}

export function buildInquiry(overrides: Partial<InquiryRecord> = {}): InquiryRecord {
  return {
    id: 'inq-1',
    organizationId: ORG,
    operatingCompanyId: COMPANY,
    branchId: BRANCH,
    customerId: 'cust-1',
    channel: 'WHATSAPP',
    touristUse: true,
    destination: 'Vilcashuaman',
    estimatedDays: 3,
    travelStartDate: null,
    partySize: null,
    dataOrigin: 'CON02',
    status: 'REGISTRADA',
    closedReason: null,
    createdAt: new Date('2026-09-23T10:00:00Z'),
    createdBy: 'uid-1',
    version: 1,
    interactions: [],
    quotations: [],
    ...overrides,
  };
}

export function buildInquiryRepository(existing: InquiryRecord | null = buildInquiry()): jest.Mocked<InquiryRepositoryPort> {
  return {
    create: jest.fn().mockImplementation(async (input) => buildInquiry({ ...input })),
    findById: jest.fn().mockResolvedValue(existing),
    list: jest.fn().mockResolvedValue([]),
    findCustomerById: jest.fn().mockResolvedValue({
      id: 'cust-1',
      organizationId: ORG,
      operatingCompanyId: COMPANY,
      fullName: 'Ana Prospecto',
      nationality: 'PERUANO',
      countryEntryDate: null,
    }),
    createCustomer: jest.fn().mockResolvedValue({
      id: 'cust-new',
      organizationId: ORG,
      operatingCompanyId: COMPANY,
      fullName: 'Ana Prospecto',
      nationality: 'PERUANO',
      countryEntryDate: null,
    }),
    quote: jest.fn().mockImplementation(async () => buildInquiry({ status: 'COTIZADA', version: 2 })),
    close: jest.fn().mockImplementation(async () => buildInquiry({ status: 'CERRADA_SIN_CONVERSION', version: 2 })),
    convertToReservation: jest.fn().mockImplementation(async () => buildInquiry({ status: 'CONVERTIDA', version: 3 })),
    convertToRental: jest.fn().mockImplementation(async () => buildInquiry({ status: 'CONVERTIDA', version: 3 })),
  };
}

/** WorkContextAuthorizationService simulado: 'forbidden' = asignacion no vigente. */
export function buildWorkContext(role: WorkerRole | 'forbidden' = 'FRONT_OFFICE'): jest.Mocked<WorkContextAuthorizationService> {
  return {
    authorize:
      role === 'forbidden'
        ? jest.fn().mockRejectedValue(new ForbiddenException())
        : jest.fn().mockResolvedValue({ organizationId: ORG, companyId: COMPANY, branchId: BRANCH, role }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
}

/** Ejecuta `work` con un `tx` ficticio y registra las opciones pedidas. */
export function buildTransactionManager(): jest.Mocked<TransactionManagerPort> & { tx: Prisma.TransactionClient } {
  const tx = { marker: 'tx' } as unknown as Prisma.TransactionClient;
  return {
    tx,
    run: jest.fn().mockImplementation(async (work: (t: Prisma.TransactionClient) => Promise<unknown>) => work(tx)),
  } as unknown as jest.Mocked<TransactionManagerPort> & { tx: Prisma.TransactionClient };
}

export class FixedClock extends ClockPort {
  constructor(private instant: Date) {
    super();
  }
  now(): Date {
    return new Date(this.instant.getTime());
  }
  set(instant: Date): void {
    this.instant = instant;
  }
}

export function buildMatrixAuth(): jest.Mocked<MatrixAuthorizationService> {
  return {
    isAllowed: jest.fn().mockResolvedValue(true),
    assertAllowed: jest.fn().mockImplementation(async (_orgId: string, role: WorkerRole, module: 'INQUIRY' | 'RESERVATION' | 'RENTAL', action: any) => {
      if (module === 'INQUIRY') {
        assertInquiryRoleAllowed(role, action as InquiryAction);
      } else if (module === 'RESERVATION') {
        assertReservationRoleAllowed(role, action as ReservationAction);
      } else if (module === 'RENTAL') {
        assertRentalRoleAllowed(role, action as RentalAction);
      }
    }),
  } as unknown as jest.Mocked<MatrixAuthorizationService>;
}
