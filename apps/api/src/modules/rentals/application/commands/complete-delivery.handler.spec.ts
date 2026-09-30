import { CompleteDeliveryHandler } from './complete-delivery.handler';
import { CompleteDeliveryCommand } from './complete-delivery.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { FleetVehicleRepositoryPort } from '../../../fleet/application/ports/fleet-vehicle-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { MissingDeliveryEvidenceError, RentalStateConflictError } from '../../domain/rental-errors';

describe('CompleteDeliveryHandler', () => {
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
    planCode: 'NORMAL',
    status: 'PENDING_DELIVERY',
    startAt: null,
    expectedEndAt: new Date(Date.now() + 86400000),
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
      completeDelivery: jest.fn().mockResolvedValue({
        ...fakeRental,
        status: 'ACTIVE',
        startAt: new Date(),
        version: 5,
      }),
    } as unknown as jest.Mocked<RentalRepositoryPort>;

    const fleetVehicles = {
      updateStatus: jest.fn().mockResolvedValue({} as any),
    } as unknown as jest.Mocked<FleetVehicleRepositoryPort>;

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

    return { rentals, fleetVehicles, workContext, matrixAuth, transactionManager, auditRepository, outboxRepository };
  }

  it('completa entrega exitosamente con 35 fotos y 3 videos (BR-INS-003/004) y actualiza vehiculo a RENTED', async () => {
    const deps = buildDeps();
    const handler = new CompleteDeliveryHandler(
      deps.rentals,
      deps.fleetVehicles,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    const result = await handler.execute(
      new CompleteDeliveryCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 4, 35, 3),
    );

    expect(result.status).toBe('ACTIVE');
    expect(deps.fleetVehicles.updateStatus).toHaveBeenCalledWith(
      'veh-1',
      { organizationId: 'org-1', operatingCompanyId: 'comp-1' },
      'RENTED',
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'EntregaCompletada.v1' }),
      fakeTx,
    );
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELIVERY_COMPLETED' }),
      fakeTx,
    );
  });

  it('rechaza con MissingDeliveryEvidenceError si faltan fotos (minimo 35)', async () => {
    const deps = buildDeps();
    const handler = new CompleteDeliveryHandler(
      deps.rentals,
      deps.fleetVehicles,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(new CompleteDeliveryCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 4, 30, 3)),
    ).rejects.toThrow(MissingDeliveryEvidenceError);
  });

  it('rechaza con MissingDeliveryEvidenceError si faltan videos (minimo 3)', async () => {
    const deps = buildDeps();
    const handler = new CompleteDeliveryHandler(
      deps.rentals,
      deps.fleetVehicles,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(new CompleteDeliveryCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 4, 35, 2)),
    ).rejects.toThrow(MissingDeliveryEvidenceError);
  });

  it('rechaza si el alquiler no se encuentra en PENDING_DELIVERY', async () => {
    const deps = buildDeps();
    deps.rentals.findById.mockResolvedValueOnce({ ...fakeRental, status: 'CONTRACTING' });

    const handler = new CompleteDeliveryHandler(
      deps.rentals,
      deps.fleetVehicles,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(new CompleteDeliveryCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 4, 35, 3)),
    ).rejects.toThrow(RentalStateConflictError);
  });
});
