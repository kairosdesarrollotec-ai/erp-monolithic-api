import { RejectExtensionHandler } from './reject-extension.handler';
import { RejectExtensionCommand } from './reject-extension.command';
import { RentalRepositoryPort, RentalRecord, RentalExtensionRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { testRole } from '../../../users/testing/role-fixtures';

describe('RejectExtensionHandler', () => {
  const fakeRental: RentalRecord = {
    id: 'rent-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Maria Lopez',
    customerDocNumber: '87654321',
    vehicleId: 'veh-1',
    vehiclePlate: 'XYZ-789',
    vehicleBrand: 'Nissan',
    vehicleModel: 'Versa',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'EXTENSION_PENDING',
    startAt: new Date('2026-10-01T00:00:00Z'),
    expectedEndAt: new Date('2026-10-07T00:00:00Z'),
    alcoholTestResult: 'FAVORABLE',
    createdAt: new Date(),
    createdBy: 'uid-user',
    updatedAt: new Date(),
    updatedBy: 'uid-user',
    version: 5,
  };

  const fakeExtension: RentalExtensionRecord = {
    id: 'ext-1',
    rentalId: 'rent-1',
    requestedEndAt: new Date('2026-10-09T00:00:00Z'),
    status: 'PENDING',
    paymentId: null,
    addendumDocumentRef: null,
    requestedAt: new Date('2026-10-05T00:00:00Z'),
    resolvedAt: null,
  };

  const fakeTx = {} as any;

  function buildDeps() {
    const rentals = {
      findById: jest.fn().mockResolvedValue(fakeRental),
      findPendingExtensionByRentalId: jest.fn().mockResolvedValue(fakeExtension),
      rejectExtension: jest.fn().mockResolvedValue({
        ...fakeRental,
        status: 'ACTIVE',
        version: 6,
      }),
    } as unknown as jest.Mocked<RentalRepositoryPort>;

    const workContext = {
      authorize: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        companyId: 'comp-1',
        branchId: 'branch-1',
        ...testRole('FRONT_OFFICE'),
      }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;

    const matrixAuth = {
      assertAllowed: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MatrixAuthorizationService>;

    const transactionManager: jest.Mocked<TransactionManagerPort> = {
      run: jest.fn((work: any) => work(fakeTx)),
    };

    const auditRepository: jest.Mocked<AuditEventRepositoryPort> = {
      recordLoginAttempt: jest.fn(),
      recordWorkContextSelection: jest.fn(),
      recordReservationEvent: jest.fn(),
      recordInquiryEvent: jest.fn(),
      recordAdminEvent: jest.fn(),
      recordRentalEvent: jest.fn().mockResolvedValue(undefined),
      recordIncidentEvent: jest.fn(),
      recordRecruitmentEvent: jest.fn(),
    };

    const outboxRepository: jest.Mocked<OutboxEventRepositoryPort> = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    return { rentals, workContext, matrixAuth, transactionManager, auditRepository, outboxRepository };
  }

  function buildHandler(deps: ReturnType<typeof buildDeps>) {
    return new RejectExtensionHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );
  }

  it('rechaza la ampliacion y regresa el alquiler a ACTIVE sin extender el plazo', async () => {
    const deps = buildDeps();
    const handler = buildHandler(deps);

    const result = await handler.execute(
      new RejectExtensionCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 5),
    );

    expect(result.status).toBe('ACTIVE');
    expect(deps.rentals.rejectExtension).toHaveBeenCalledWith(
      expect.objectContaining({ rentalId: 'rent-1', extensionId: 'ext-1' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'AmpliacionRechazada.v1' }),
      fakeTx,
    );
  });

  it('rechaza si el alquiler no esta en EXTENSION_PENDING', async () => {
    const deps = buildDeps();
    deps.rentals.findById.mockResolvedValue({ ...fakeRental, status: 'ACTIVE' });
    const handler = buildHandler(deps);

    await expect(
      handler.execute(new RejectExtensionCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 5)),
    ).rejects.toThrow(RentalStateConflictError);
  });
});
