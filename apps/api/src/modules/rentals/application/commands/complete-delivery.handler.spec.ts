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
import { RentalEvidenceRepositoryPort } from '../ports/rental-evidence-repository.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { RentalCreationGuard } from '../services/rental-creation.guard';
import { VehicleNotAvailableForRentalError } from '../../domain/rental-errors';
import { testRole } from '../../../users/testing/role-fixtures';

const NOW = new Date('2026-10-05T15:00:00Z');

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
    vehicleDepositMinimum: null,
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
      findVehicleById: jest.fn().mockResolvedValue({
        id: 'veh-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
        plate: 'XYZ-789',
        brand: 'Nissan',
        model: 'Versa',
        status: 'AVAILABLE',
      }),
      findInquiryForRental: jest.fn().mockResolvedValue({
        id: 'inq-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
        customerId: 'cust-1',
        status: 'CONVERTIDA',
        quotations: [{ id: 'q-1', vehicleId: 'veh-1', estimatedDays: 3, validUntil: new Date(), createdAt: new Date() }],
      }),
      hasBlockingVehicleCommitment: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<RentalRepositoryPort>;

    const fleetVehicles = {
      updateStatus: jest.fn().mockResolvedValue({} as any),
    } as unknown as jest.Mocked<FleetVehicleRepositoryPort>;

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
      recordHrAdministrationEvent: jest.fn(),
    };

    const outboxRepository: jest.Mocked<OutboxEventRepositoryPort> = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const evidenceRepository = {
      record: jest.fn(),
      list: jest.fn(),
      countByType: jest.fn().mockResolvedValue({ photos: 35, videos: 3 }),
    } as unknown as jest.Mocked<RentalEvidenceRepositoryPort>;

    const clock: ClockPort = { now: () => NOW };
    const creationGuard = new RentalCreationGuard(rentals, clock);

    return {
      clock,
      creationGuard,
      rentals,
      fleetVehicles,
      workContext,
      matrixAuth,
      transactionManager,
      auditRepository,
      outboxRepository,
      evidenceRepository,
    };
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
      deps.evidenceRepository,
      deps.creationGuard,
      deps.clock,
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
    deps.evidenceRepository.countByType.mockResolvedValueOnce({ photos: 30, videos: 3 });
    const handler = new CompleteDeliveryHandler(
      deps.rentals,
      deps.fleetVehicles,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
      deps.evidenceRepository,
      deps.creationGuard,
      deps.clock,
    );

    await expect(
      handler.execute(new CompleteDeliveryCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 4, 30, 3)),
    ).rejects.toThrow(MissingDeliveryEvidenceError);
  });

  it('rechaza con MissingDeliveryEvidenceError si faltan videos (minimo 3)', async () => {
    const deps = buildDeps();
    deps.evidenceRepository.countByType.mockResolvedValueOnce({ photos: 35, videos: 2 });
    const handler = new CompleteDeliveryHandler(
      deps.rentals,
      deps.fleetVehicles,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
      deps.evidenceRepository,
      deps.creationGuard,
      deps.clock,
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
      deps.evidenceRepository,
      deps.creationGuard,
      deps.clock,
    );

    await expect(
      handler.execute(new CompleteDeliveryCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 4, 35, 3)),
    ).rejects.toThrow(RentalStateConflictError);
  });

  describe('fechas de alquiler directo vs reserva (BR-CON-002)', () => {
    const build = (deps: ReturnType<typeof buildDeps>) =>
      new CompleteDeliveryHandler(
        deps.rentals,
        deps.fleetVehicles,
        deps.workContext,
        deps.matrixAuth,
        deps.transactionManager,
        deps.auditRepository,
        deps.outboxRepository,
        deps.evidenceRepository,
        deps.creationGuard,
        deps.clock,
      );
    const run = (deps: ReturnType<typeof buildDeps>) =>
      build(deps).execute(new CompleteDeliveryCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 4));

    it('alquiler de Consulta: startAt = ahora y expectedEndAt = startAt + dias de la cotizacion', async () => {
      const deps = buildDeps();
      deps.rentals.findById.mockResolvedValue({ ...fakeRental, inquiryId: 'inq-1', expectedEndAt: null });

      await run(deps);

      expect(deps.rentals.completeDelivery).toHaveBeenCalledWith(
        expect.objectContaining({ startAt: NOW, expectedEndAt: new Date('2026-10-08T15:00:00Z') }),
        fakeTx,
      );
      expect(deps.rentals.hasBlockingVehicleCommitment).toHaveBeenCalledWith(
        'veh-1',
        'org-1',
        NOW,
        new Date('2026-10-08T15:00:00Z'),
        fakeTx,
      );
      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({ startAt: expect.any(String) }),
        }),
        fakeTx,
      );
    });

    it('alquiler de origen Reserva conserva las fechas acordadas: no se envia startAt/expectedEndAt ni se re-chequea disponibilidad', async () => {
      const deps = buildDeps();
      const agreedStart = new Date('2026-10-20T14:00:00Z');
      deps.rentals.findById.mockResolvedValue({
        ...fakeRental,
        reservationId: 'res-1',
        startAt: agreedStart,
        expectedEndAt: new Date('2026-10-22T14:00:00Z'),
      });

      await run(deps);

      const input = deps.rentals.completeDelivery.mock.calls[0][0];
      expect(input.startAt).toBeUndefined();
      expect(input.expectedEndAt).toBeUndefined();
      expect(deps.rentals.hasBlockingVehicleCommitment).not.toHaveBeenCalled();
    });

    it('alquiler directo sin consulta: startAt = ahora y conserva expectedEndAt existente', async () => {
      const deps = buildDeps();
      const existingEnd = new Date('2026-10-09T15:00:00Z');
      deps.rentals.findById.mockResolvedValue({ ...fakeRental, expectedEndAt: existingEnd });

      await run(deps);

      expect(deps.rentals.completeDelivery).toHaveBeenCalledWith(
        expect.objectContaining({ startAt: NOW, expectedEndAt: existingEnd }),
        fakeTx,
      );
    });

    it('re-chequea disponibilidad: solape -> VEHICLE_NOT_AVAILABLE y no completa la entrega ni cambia el vehiculo', async () => {
      const deps = buildDeps();
      deps.rentals.findById.mockResolvedValue({ ...fakeRental, inquiryId: 'inq-1', expectedEndAt: null });
      deps.rentals.hasBlockingVehicleCommitment.mockResolvedValueOnce(true);

      await expect(run(deps)).rejects.toBeInstanceOf(VehicleNotAvailableForRentalError);
      expect(deps.rentals.completeDelivery).not.toHaveBeenCalled();
      expect(deps.fleetVehicles.updateStatus).not.toHaveBeenCalled();
    });
  });
});
