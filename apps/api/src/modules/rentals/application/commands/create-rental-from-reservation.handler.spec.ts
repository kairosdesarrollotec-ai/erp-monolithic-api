import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateRentalFromReservationHandler } from './create-rental-from-reservation.handler';
import { CreateRentalFromReservationCommand } from './create-rental-from-reservation.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { CustomerBlockedError, ReservationStartDatePassedError, ReservationStartNotReachedError } from '../../domain/rental-errors';
import { testRole } from '../../../users/testing/role-fixtures';

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
      findCustomerById: jest.fn().mockResolvedValue({ id: 'cust-1', status: 'NORMAL' }),
      create: jest.fn().mockResolvedValue(fakeRental),
      markReservationConverted: jest.fn().mockResolvedValue(true),
      transferReservationCommitmentToRental: jest.fn().mockResolvedValue(1),
      findByReservationId: jest.fn().mockResolvedValue(null),
      findVehicleById: jest.fn().mockResolvedValue({ id: 'veh-1', depositMinimum: null }),
      findReservationCreditSource: jest.fn().mockResolvedValue(null),
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
      recordReservationEvent: jest.fn().mockResolvedValue(undefined),
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

    // 22-oct-2026 (decision 3): el reloj esta en el dia pactado de la reserva (01-oct-2026, hora de Lima).
    const clock: ClockPort = { now: () => new Date('2026-10-01T15:00:00Z') };

    return { rentals, workContext, matrixAuth, transactionManager, auditRepository, outboxRepository, clock };
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
      deps.clock,
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

  const SCOPE = { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1' };

  function buildHandler(deps: ReturnType<typeof buildDeps>) {
    return new CreateRentalFromReservationHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
      deps.clock,
    );
  }

  it('marca la reserva CONVERTED y traslada su vehicle_commitment al alquiler, en la misma transaccion (UC-RES-005)', async () => {
    const deps = buildDeps();
    await buildHandler(deps).execute(new CreateRentalFromReservationCommand('uid-1', 'comp-1', 'branch-1', 'res-1'));

    expect(deps.rentals.markReservationConverted).toHaveBeenCalledWith('res-1', SCOPE, fakeTx);
    expect(deps.rentals.transferReservationCommitmentToRental).toHaveBeenCalledWith('res-1', 'rent-200', fakeTx);
    // El orden importa: primero se gana el cambio de estado, luego se crea el alquiler.
    expect(deps.rentals.markReservationConverted.mock.invocationCallOrder[0]).toBeLessThan(
      deps.rentals.create.mock.invocationCallOrder[0],
    );
    expect(deps.auditRepository.recordReservationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 'res-1', action: 'RESERVATION_CONVERTED' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'Reservation',
        aggregateId: 'res-1',
        eventType: 'ReservationConverted',
        payload: expect.objectContaining({ reservationId: 'res-1', rentalId: 'rent-200' }),
      }),
      fakeTx,
    );
  });

  it('409 y sin crear alquiler si otra operacion cambio el estado de la reserva (carrera)', async () => {
    const deps = buildDeps();
    deps.rentals.markReservationConverted.mockResolvedValueOnce(false);

    await expect(
      buildHandler(deps).execute(new CreateRentalFromReservationCommand('uid-1', 'comp-1', 'branch-1', 'res-1')),
    ).rejects.toThrow(ConflictException);
    expect(deps.rentals.create).not.toHaveBeenCalled();
    expect(deps.outboxRepository.publish).not.toHaveBeenCalled();
  });

  it('antes del dia pactado -> 422 RESERVATION_START_NOT_REACHED; despues -> 422 RESERVATION_START_DATE_PASSED (no-show por Gerencia); no convierte nada', async () => {
    const early = buildDeps();
    early.clock.now = () => new Date('2026-09-30T15:00:00Z');
    await expect(
      buildHandler(early).execute(new CreateRentalFromReservationCommand('uid-1', 'comp-1', 'branch-1', 'res-1')),
    ).rejects.toBeInstanceOf(ReservationStartNotReachedError);

    const late = buildDeps();
    late.clock.now = () => new Date('2026-10-02T15:00:00Z');
    await expect(
      buildHandler(late).execute(new CreateRentalFromReservationCommand('uid-1', 'comp-1', 'branch-1', 'res-1')),
    ).rejects.toBeInstanceOf(ReservationStartDatePassedError);
    expect(early.rentals.markReservationConverted).not.toHaveBeenCalled();
    expect(late.rentals.markReservationConverted).not.toHaveBeenCalled();
  });

  it('cliente ROJO: no se convierte la reserva existente en alquiler (29-oct #3); AMBAR si se permite', async () => {
    const red = buildDeps();
    (red.rentals.findCustomerById as jest.Mock).mockResolvedValue({ id: 'cust-1', status: 'ROJO' });
    await expect(
      buildHandler(red).execute(new CreateRentalFromReservationCommand('uid-1', 'comp-1', 'branch-1', 'res-1')),
    ).rejects.toBeInstanceOf(CustomerBlockedError);
    expect(red.rentals.markReservationConverted).not.toHaveBeenCalled();

    const amber = buildDeps();
    (amber.rentals.findCustomerById as jest.Mock).mockResolvedValue({ id: 'cust-1', status: 'AMBAR' });
    const result = await buildHandler(amber).execute(
      new CreateRentalFromReservationCommand('uid-1', 'comp-1', 'branch-1', 'res-1'),
    );
    expect(result.id).toBe('rent-200');
  });

  it('es idempotente: una reserva ya CONVERTED devuelve el alquiler existente sin crear otro', async () => {
    const deps = buildDeps();
    deps.rentals.findReservationById.mockResolvedValueOnce({ ...fakeReservation, status: 'CONVERTED' });
    deps.rentals.findByReservationId.mockResolvedValueOnce(fakeRental);

    const result = await buildHandler(deps).execute(
      new CreateRentalFromReservationCommand('uid-1', 'comp-1', 'branch-1', 'res-1'),
    );

    expect(result.id).toBe('rent-200');
    expect(deps.rentals.create).not.toHaveBeenCalled();
    expect(deps.rentals.markReservationConverted).not.toHaveBeenCalled();
  });

  it('rechaza (409) una reserva CANCELLED, p. ej. tras un no-show', async () => {
    const deps = buildDeps();
    deps.rentals.findReservationById.mockResolvedValueOnce({ ...fakeReservation, status: 'CANCELLED' });

    await expect(
      buildHandler(deps).execute(new CreateRentalFromReservationCommand('uid-1', 'comp-1', 'branch-1', 'res-1')),
    ).rejects.toThrow(ConflictException);
    expect(deps.rentals.markReservationConverted).not.toHaveBeenCalled();
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
      deps.clock,
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
      deps.clock,
    );

    await expect(
      handler.execute(new CreateRentalFromReservationCommand('uid-1', 'comp-1', 'branch-1', 'res-inexistente')),
    ).rejects.toThrow(NotFoundException);
  });
});
