import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FlagVehicleSaleHandler } from './flag-vehicle-sale.handler';
import { FlagVehicleSaleCommand } from './flag-vehicle-sale.command';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { ReservationSaleResolutionRepositoryPort } from '../ports/reservation-sale-resolution-repository.port';
import { SaleAlternativeVehicleGuard } from '../services/sale-alternative-vehicle.guard';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReservationStateConflictError } from '../../domain/reservation-errors';
import { AlternativeVehicleInvalidError } from '../../domain/reservation-sale-resolution';
import { roleKeyOfTestRoleId, testRole } from '../../../users/testing/role-fixtures';

function buildRecord(overrides: Partial<ReservationRecord> = {}): ReservationRecord {
  return {
    id: 'res-1', organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1',
    inquiryId: 'inq-1', customerId: 'cust-1', customerName: 'Maria Quispe', vehicleId: 'veh-1',
    vehiclePlate: 'D0Y-704', vehicleLabel: 'Toyota Hilux - D0Y-704', status: 'CONFIRMED',
    channelMode: 'PRESENCIAL', startAt: new Date('2026-10-20T14:00:00Z'), endAt: new Date('2026-10-22T14:00:00Z'),
    requiredPaymentAmount: '300.00', currency: 'PEN', paymentPolicyVersion: 1,
    paymentValidatedAt: new Date(), documentsCompletedAt: new Date(), confirmedAt: new Date(),
    createdAt: new Date(), createdBy: 'uid-1', version: 2,
    ...overrides,
  };
}

const SCOPE = { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1' };
const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(existing: ReservationRecord | null, role = 'GERENCIA') {
  const reservations = { findById: jest.fn().mockResolvedValue(existing) } as unknown as jest.Mocked<ReservationRepositoryPort>;
  const saleResolutions = {
    flagSale: jest.fn().mockImplementation(async () => ({ ...existing, status: 'PENDING_SALE_RESOLUTION', version: 3 })),
  } as unknown as jest.Mocked<ReservationSaleResolutionRepositoryPort>;
  const alternativeGuard = { assertUsable: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<SaleAlternativeVehicleGuard>;
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
  const handler = new FlagVehicleSaleHandler(reservations, saleResolutions, alternativeGuard, workContext, matrixAuth, audit, outbox, transactionManager);
  return { handler, reservations, saleResolutions, alternativeGuard, matrixAuth, audit, outbox, transactionManager };
}

describe('FlagVehicleSaleHandler (UC-RES-004, RES-07)', () => {
  it('pasa CONFIRMED -> PENDING_SALE_RESOLUTION con scope+version, valida la alternativa, audita y publica outbox', async () => {
    const deps = buildDeps(buildRecord());

    const result = await deps.handler.execute(
      new FlagVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2, 'veh-2', 'Vendido el lunes'),
    );

    expect(result.status).toBe('PENDING_SALE_RESOLUTION');
    expect(deps.matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'role-GERENCIA', 'RESERVATION', 'FLAG_SALE', expect.anything());
    expect(deps.alternativeGuard.assertUsable).toHaveBeenCalledWith(expect.objectContaining({ id: 'res-1' }), 'veh-2', FAKE_TX);
    expect(deps.saleResolutions.flagSale).toHaveBeenCalledWith(
      { ...SCOPE, id: 'res-1', expectedVersion: 2, flaggedBy: 'uid-1', offeredVehicleId: 'veh-2', note: 'Vendido el lunes' },
      FAKE_TX,
    );
    expect(deps.transactionManager.run).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(deps.audit.recordReservationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESERVATION_VEHICLE_SALE_FLAGGED', reservationId: 'res-1', actorUserId: 'uid-1' }),
      FAKE_TX,
    );
    expect(deps.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({ aggregateType: 'Reservation', aggregateId: 'res-1', eventType: 'ReservationVehicleSaleFlagged' }),
      FAKE_TX,
    );
  });

  it('la alternativa es opcional: sin ella no consulta el guard', async () => {
    const deps = buildDeps(buildRecord());
    await deps.handler.execute(new FlagVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2));
    expect(deps.alternativeGuard.assertUsable).not.toHaveBeenCalled();
    expect(deps.saleResolutions.flagSale).toHaveBeenCalledWith(expect.objectContaining({ offeredVehicleId: undefined }), FAKE_TX);
  });

  it.each(['DRAFT', 'PENDING_SALE_RESOLUTION', 'CONVERTED', 'CANCELLED'] as const)(
    'rechaza (409 RESERVATION_STATE_CONFLICT) si la reserva esta en %s: solo CONFIRMED',
    async (status) => {
      const deps = buildDeps(buildRecord({ status }));
      await expect(
        deps.handler.execute(new FlagVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2)),
      ).rejects.toBeInstanceOf(ReservationStateConflictError);
      expect(deps.saleResolutions.flagSale).not.toHaveBeenCalled();
    },
  );

  it('propaga el rechazo del guard de la alternativa y no registra la venta', async () => {
    const deps = buildDeps(buildRecord());
    deps.alternativeGuard.assertUsable.mockRejectedValueOnce(new AlternativeVehicleInvalidError('no'));
    await expect(
      deps.handler.execute(new FlagVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2, 'veh-2')),
    ).rejects.toBeInstanceOf(AlternativeVehicleInvalidError);
    expect(deps.saleResolutions.flagSale).not.toHaveBeenCalled();
    expect(deps.audit.recordReservationEvent).not.toHaveBeenCalled();
  });

  it('404 si la reserva no existe en el scope completo', async () => {
    const deps = buildDeps(null);
    await expect(
      deps.handler.execute(new FlagVehicleSaleCommand('res-x', 'uid-1', 'company-1', 'branch-1', 2)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.reservations.findById).toHaveBeenCalledWith('res-x', SCOPE);
  });

  it('solo Gerencia/Administracion: FRONT_OFFICE recibe ROLE_NOT_ALLOWED', async () => {
    const deps = buildDeps(buildRecord(), 'FRONT_OFFICE');
    await expect(
      deps.handler.execute(new FlagVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(deps.reservations.findById).not.toHaveBeenCalled();
  });

  it('permite al Administrador (ADMINISTRACION)', async () => {
    const deps = buildDeps(buildRecord(), 'ADMINISTRACION');
    await expect(
      deps.handler.execute(new FlagVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2)),
    ).resolves.toBeDefined();
  });
});
