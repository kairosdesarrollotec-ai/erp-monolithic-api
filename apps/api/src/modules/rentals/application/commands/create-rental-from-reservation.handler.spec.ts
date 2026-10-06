import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateRentalFromReservationHandler } from './create-rental-from-reservation.handler';
import { CreateRentalFromReservationCommand } from './create-rental-from-reservation.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';

describe('CreateRentalFromReservationHandler (RES-05)', () => {
  const fakeReservation = {
    id: 'res-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    status: 'CONFIRMED',
    startAt: new Date('2026-10-01T10:00:00Z'),
    endAt: new Date('2026-10-05T10:00:00Z'),
  };

  const fakeRental: RentalRecord = {
    id: 'rent-200',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: 'res-1',
    customerId: 'cust-1',
    customerName: 'Juanita Perez',
    customerDocNumber: '11223344',
    vehicleId: 'veh-1',
    vehiclePlate: 'ABC-123',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Corolla',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'DRAFT',
    startAt: fakeReservation.startAt,
    expectedEndAt: fakeReservation.endAt,
    alcoholTestResult: null,
    createdAt: new Date(),
    createdBy: 'uid-user',
    updatedAt: new Date(),
    updatedBy: 'uid-user',
    version: 1,
  };

  const fakeTx = {} as any;

  function buildDeps() {
    const rentals = {
      findReservationById: jest.fn().mockResolvedValue(fakeReservation),
      create: jest.fn().mockResolvedValue(fakeRental),
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
      recordIncidentEvent: jest.fn(),
    };

    const outboxRepository: jest.Mocked<OutboxEventRepositoryPort> = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    return { rentals, workContext, matrixAuth, transactionManager, auditRepository, outboxRepository };
  }

  it('crea alquiler exitosamente a partir de reserva confirmada (RES-05)', async () => {
    const deps = buildDeps();
    const handler = new CreateRentalFromReservationHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    const result = await handler.execute(
      new CreateRentalFromReservationCommand('uid-1', 'comp-1', 'branch-1', 'res-1'),
    );

    expect(result.status).toBe('DRAFT');
    expect(result.reservationId).toBe('res-1');
    expect(deps.rentals.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 'res-1',
        customerId: 'cust-1',
        vehicleId: 'veh-1',
      }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'RentalCreatedFromReservation.v1' }),
      fakeTx,
    );
  });

  it('rechaza si la reserva no esta en estado CONFIRMED', async () => {
    const deps = buildDeps();
    deps.rentals.findReservationById.mockResolvedValueOnce({
      ...fakeReservation,
      status: 'DRAFT',
    });

    const handler = new CreateRentalFromReservationHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(new CreateRentalFromReservationCommand('uid-1', 'comp-1', 'branch-1', 'res-1')),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza si la reserva no existe en la sede del contexto de trabajo', async () => {
    const deps = buildDeps();
    deps.rentals.findReservationById.mockResolvedValueOnce(null);

    const handler = new CreateRentalFromReservationHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(new CreateRentalFromReservationCommand('uid-1', 'comp-1', 'branch-1', 'res-inexistente')),
    ).rejects.toThrow(NotFoundException);
  });
});
