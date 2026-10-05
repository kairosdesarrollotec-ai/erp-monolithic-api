import { RequestExtensionHandler } from './request-extension.handler';
import { RequestExtensionCommand } from './request-extension.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import {
  RentalStateConflictError,
  ExtensionAdvanceNoticeError,
  ExtensionMaxDurationError,
} from '../../domain/rental-errors';

describe('RequestExtensionHandler', () => {
  const now = new Date('2026-10-05T00:00:00Z');

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
    status: 'ACTIVE',
    startAt: new Date('2026-10-01T00:00:00Z'),
    expectedEndAt: new Date('2026-10-07T00:00:00Z'), // 48h ahead of `now`
    alcoholTestResult: 'FAVORABLE',
    createdAt: new Date(),
    createdBy: 'uid-user',
    updatedAt: new Date(),
    updatedBy: 'uid-user',
    version: 4,
  };

  const fakeTx = {} as any;

  function buildDeps() {
    const rentals = {
      findById: jest.fn().mockResolvedValue(fakeRental),
      requestExtension: jest.fn().mockResolvedValue({
        ...fakeRental,
        status: 'EXTENSION_PENDING',
        version: 5,
      }),
    } as unknown as jest.Mocked<RentalRepositoryPort>;

    const workContext = {
      authorize: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        companyId: 'comp-1',
        branchId: 'branch-1',
        role: 'FRONT_OFFICE',
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
    };

    const outboxRepository: jest.Mocked<OutboxEventRepositoryPort> = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    return { rentals, workContext, matrixAuth, transactionManager, auditRepository, outboxRepository };
  }

  function buildHandler(deps: ReturnType<typeof buildDeps>) {
    return new RequestExtensionHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('solicita la ampliacion exitosamente (aviso >= 12h, duracion <= 3 dias) y transiciona a EXTENSION_PENDING', async () => {
    const deps = buildDeps();
    const handler = buildHandler(deps);

    const requestedEndAt = new Date('2026-10-09T00:00:00Z'); // +2 dias sobre expectedEndAt

    const result = await handler.execute(
      new RequestExtensionCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 4, requestedEndAt),
    );

    expect(result.status).toBe('EXTENSION_PENDING');
    expect(deps.rentals.requestExtension).toHaveBeenCalledWith(
      expect.objectContaining({ rentalId: 'rent-1', requestedEndAt }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'AmpliacionSolicitada.v1' }),
      fakeTx,
    );
  });

  it('rechaza con ExtensionAdvanceNoticeError si faltan menos de 12h para el vencimiento actual', async () => {
    const deps = buildDeps();
    deps.rentals.findById.mockResolvedValue({
      ...fakeRental,
      expectedEndAt: new Date('2026-10-05T06:00:00Z'), // solo 6h desde `now`
    });
    const handler = buildHandler(deps);

    await expect(
      handler.execute(
        new RequestExtensionCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 4, new Date('2026-10-06T00:00:00Z')),
      ),
    ).rejects.toThrow(ExtensionAdvanceNoticeError);
  });

  it('rechaza con ExtensionMaxDurationError si la ampliacion excede 3 dias', async () => {
    const deps = buildDeps();
    const handler = buildHandler(deps);

    const requestedEndAt = new Date('2026-10-11T00:01:00Z'); // 4 dias + 1min sobre expectedEndAt

    await expect(
      handler.execute(new RequestExtensionCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 4, requestedEndAt)),
    ).rejects.toThrow(ExtensionMaxDurationError);
  });

  it('rechaza si el alquiler no esta en ACTIVE', async () => {
    const deps = buildDeps();
    deps.rentals.findById.mockResolvedValue({ ...fakeRental, status: 'PENDING_DELIVERY' });
    const handler = buildHandler(deps);

    await expect(
      handler.execute(
        new RequestExtensionCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 4, new Date('2026-10-09T00:00:00Z')),
      ),
    ).rejects.toThrow(RentalStateConflictError);
  });
});
