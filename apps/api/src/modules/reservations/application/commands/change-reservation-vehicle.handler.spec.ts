import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChangeReservationVehicleHandler } from './change-reservation-vehicle.handler';
import { ChangeReservationVehicleCommand } from './change-reservation-vehicle.command';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { ReservationSaleResolutionRepositoryPort } from '../ports/reservation-sale-resolution-repository.port';
import { SaleAlternativeVehicleGuard } from '../services/sale-alternative-vehicle.guard';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReservationExceedsGuaranteeError, ReservationStateConflictError, ReservationVersionConflictError, VehicleNotAvailableError } from '../../domain/reservation-errors';
import { AlternativeVehicleInvalidError } from '../../domain/reservation-sale-resolution';
import { roleKeyOfTestRoleId, testRole } from '../../../users/testing/role-fixtures';

function buildRecord(overrides: Partial<ReservationRecord> = {}): ReservationRecord {
  return {
    id: 'res-1', organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1',
    inquiryId: 'inq-1', customerId: 'cust-1', customerName: 'Maria Quispe', vehicleId: 'veh-1',
    vehiclePlate: 'D0Y-704', vehicleLabel: 'Toyota Hilux - D0Y-704', status: 'DRAFT',
    channelMode: 'PRESENCIAL', startAt: new Date('2026-10-20T14:00:00Z'), endAt: new Date('2026-10-22T14:00:00Z'),
    requiredPaymentAmount: '300.00', currency: 'PEN', paymentPolicyVersion: 1,
    paymentValidatedAt: new Date(), documentsCompletedAt: new Date(), confirmedAt: null,
    createdAt: new Date(), createdBy: 'uid-1', version: 2,
    ...overrides,
  };
}

const SCOPE = { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1' };
const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(existing: ReservationRecord | null, role = 'FRONT_OFFICE', newVehicleDepositMinimum: number | null = 500) {
  const reservations = {
    findById: jest.fn().mockResolvedValue(existing),
    findVehicleById: jest.fn().mockResolvedValue({ id: 'veh-2', depositMinimum: newVehicleDepositMinimum }),
  } as unknown as jest.Mocked<ReservationRepositoryPort>;
  const saleResolutions = {
    changeVehicle: jest.fn().mockImplementation(async () => ({ ...existing, vehicleId: 'veh-2', documentsCompletedAt: null, version: 3 })),
  } as unknown as jest.Mocked<ReservationSaleResolutionRepositoryPort>;
  const vehicleGuard = { assertUsable: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<SaleAlternativeVehicleGuard>;
  const workContext = {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', ...testRole(role) }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
  const matrixAuth = {
    assertAllowed: jest.fn().mockImplementation(async (_org, roleId, _mod, action) => {
      assertReservationRoleAllowed(roleKeyOfTestRoleId(roleId), action);
    }),
  } as unknown as MatrixAuthorizationService;
  const audit = { recordReservationEvent: jest.fn() } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const outbox = { publish: jest.fn() } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
  const transactionManager: jest.Mocked<TransactionManagerPort> = { run: jest.fn((work: any) => work(FAKE_TX)) };
  const handler = new ChangeReservationVehicleHandler(reservations, saleResolutions, vehicleGuard, workContext, matrixAuth, audit, outbox, transactionManager);
  return { handler, reservations, saleResolutions, vehicleGuard, matrixAuth, audit, outbox, transactionManager };
}

const cmd = (version = 2, vehicleId = 'veh-2') =>
  new ChangeReservationVehicleCommand('res-1', 'uid-1', 'company-1', 'branch-1', version, vehicleId);

describe('ChangeReservationVehicleHandler (RES-06, DEC-RES-CHANGE-VEHICLE-001)', () => {
  it('cambia el vehiculo de un DRAFT con scope+version, audita anterior/nuevo y publica outbox en la misma tx Serializable', async () => {
    const deps = buildDeps(buildRecord());

    const result = await deps.handler.execute(cmd());

    expect(result.vehicleId).toBe('veh-2');
    expect(result.version).toBe(3);
    expect(deps.matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'role-FRONT_OFFICE', 'RESERVATION', 'CHANGE_VEHICLE', expect.anything());
    expect(deps.vehicleGuard.assertUsable).toHaveBeenCalledWith(expect.objectContaining({ id: 'res-1' }), 'veh-2', FAKE_TX);
    expect(deps.saleResolutions.changeVehicle).toHaveBeenCalledWith({ ...SCOPE, id: 'res-1', expectedVersion: 2, vehicleId: 'veh-2' }, FAKE_TX);
    expect(deps.transactionManager.run).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(deps.audit.recordReservationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RESERVATION_VEHICLE_CHANGED',
        reservationId: 'res-1',
        actorUserId: 'uid-1',
        changes: expect.objectContaining({ previousVehicleId: 'veh-1', vehicleId: 'veh-2', paymentKept: true }),
      }),
      FAKE_TX,
    );
    expect(deps.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'Reservation',
        aggregateId: 'res-1',
        eventType: 'ReservationVehicleChanged',
        payload: expect.objectContaining({ previousVehicleId: 'veh-1', vehicleId: 'veh-2' }),
      }),
      FAKE_TX,
    );
  });

  it.each(['CONFIRMED', 'PENDING_SALE_RESOLUTION', 'CONVERTED', 'CANCELLED'] as const)(
    'rechaza (409 RESERVATION_STATE_CONFLICT) si la reserva esta en %s: solo DRAFT (BR-RES-003)',
    async (status) => {
      const deps = buildDeps(buildRecord({ status }));
      await expect(deps.handler.execute(cmd())).rejects.toBeInstanceOf(ReservationStateConflictError);
      expect(deps.saleResolutions.changeVehicle).not.toHaveBeenCalled();
    },
  );

  it('F-01: 422 RESERVATION_EXCEEDS_GUARANTEE si el monto de la reserva (300) supera la garantia del vehiculo nuevo; no escribe ni audita', async () => {
    const deps = buildDeps(buildRecord(), 'FRONT_OFFICE', 250);
    await expect(deps.handler.execute(cmd())).rejects.toBeInstanceOf(ReservationExceedsGuaranteeError);
    expect(deps.saleResolutions.changeVehicle).not.toHaveBeenCalled();
    expect(deps.audit.recordReservationEvent).not.toHaveBeenCalled();
    expect(deps.outbox.publish).not.toHaveBeenCalled();
  });

  it('F-01: acepta el cambio si el vehiculo nuevo no tiene garantia definida (null)', async () => {
    const deps = buildDeps(buildRecord(), 'FRONT_OFFICE', null);
    const result = await deps.handler.execute(cmd());
    expect(result.vehicleId).toBe('veh-2');
  });

  it('409 VEHICLE_NOT_AVAILABLE si el vehiculo esta ocupado en la ventana; no escribe ni audita', async () => {
    const deps = buildDeps(buildRecord());
    deps.vehicleGuard.assertUsable.mockRejectedValueOnce(
      new VehicleNotAvailableError({ from: new Date('2026-10-21T00:00:00Z'), to: new Date('2026-10-23T00:00:00Z') }),
    );
    await expect(deps.handler.execute(cmd())).rejects.toBeInstanceOf(VehicleNotAvailableError);
    expect(deps.saleResolutions.changeVehicle).not.toHaveBeenCalled();
    expect(deps.audit.recordReservationEvent).not.toHaveBeenCalled();
    expect(deps.outbox.publish).not.toHaveBeenCalled();
  });

  it('422 ALTERNATIVE_VEHICLE_INVALID si el vehiculo es invalido (mismo, otra empresa/sede o no AVAILABLE)', async () => {
    const deps = buildDeps(buildRecord());
    deps.vehicleGuard.assertUsable.mockRejectedValueOnce(new AlternativeVehicleInvalidError('no'));
    await expect(deps.handler.execute(cmd(2, 'veh-1'))).rejects.toBeInstanceOf(AlternativeVehicleInvalidError);
    expect(deps.saleResolutions.changeVehicle).not.toHaveBeenCalled();
  });

  it('412 RESERVATION_VERSION_CONFLICT si el update atomico no encuentra la version; no audita ni publica', async () => {
    const deps = buildDeps(buildRecord());
    deps.saleResolutions.changeVehicle.mockRejectedValueOnce(new ReservationVersionConflictError());
    await expect(deps.handler.execute(cmd(1))).rejects.toBeInstanceOf(ReservationVersionConflictError);
    expect(deps.audit.recordReservationEvent).not.toHaveBeenCalled();
    expect(deps.outbox.publish).not.toHaveBeenCalled();
  });

  it('404 si la reserva no existe en el scope completo', async () => {
    const deps = buildDeps(null);
    await expect(deps.handler.execute(cmd())).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.reservations.findById).toHaveBeenCalledWith('res-1', SCOPE);
  });

  it('AUDITORIA recibe ROLE_NOT_ALLOWED y no se consulta la reserva', async () => {
    const deps = buildDeps(buildRecord(), 'AUDITORIA');
    await expect(deps.handler.execute(cmd())).rejects.toBeInstanceOf(ForbiddenException);
    expect(deps.reservations.findById).not.toHaveBeenCalled();
  });

  it.each(['GERENCIA', 'ADMINISTRACION'])('permite a %s', async (role) => {
    const deps = buildDeps(buildRecord(), role);
    await expect(deps.handler.execute(cmd())).resolves.toBeDefined();
  });
});
