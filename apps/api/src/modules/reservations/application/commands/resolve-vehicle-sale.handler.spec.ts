import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ResolveVehicleSaleHandler } from './resolve-vehicle-sale.handler';
import { ResolveVehicleSaleCommand } from './resolve-vehicle-sale.command';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { ReservationSaleResolutionRepositoryPort } from '../ports/reservation-sale-resolution-repository.port';
import { SaleAlternativeVehicleGuard } from '../services/sale-alternative-vehicle.guard';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReservationStateConflictError, VehicleNotAvailableError } from '../../domain/reservation-errors';
import { AlternativeVehicleRequiredError } from '../../domain/reservation-sale-resolution';
import { roleKeyOfTestRoleId, testRole } from '../../../users/testing/role-fixtures';

function buildRecord(overrides: Partial<ReservationRecord> = {}): ReservationRecord {
  return {
    id: 'res-1', organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1',
    inquiryId: 'inq-1', customerId: 'cust-1', customerName: 'Maria Quispe', vehicleId: 'veh-1',
    vehiclePlate: 'D0Y-704', vehicleLabel: 'Toyota Hilux - D0Y-704', status: 'PENDING_SALE_RESOLUTION',
    channelMode: 'PRESENCIAL', startAt: new Date('2026-10-20T14:00:00Z'), endAt: new Date('2026-10-22T14:00:00Z'),
    requiredPaymentAmount: '300.00', currency: 'PEN', paymentPolicyVersion: 1,
    paymentValidatedAt: new Date(), documentsCompletedAt: new Date(), confirmedAt: new Date(),
    createdAt: new Date(), createdBy: 'uid-1', version: 3,
    ...overrides,
  };
}

const SCOPE = { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1' };
const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(existing: ReservationRecord | null, role = 'GERENCIA', offeredId: string | null = 'veh-offered') {
  const reservations = { findById: jest.fn().mockResolvedValue(existing) } as unknown as jest.Mocked<ReservationRepositoryPort>;
  const saleResolutions = {
    findLatestByReservationId: jest.fn().mockResolvedValue(
      offeredId ? { id: 'rs-1', status: 'PENDING', offeredVehicle: { id: offeredId, plate: 'X', label: 'X' } } : { id: 'rs-1', status: 'PENDING', offeredVehicle: null },
    ),
    rejectSale: jest.fn().mockImplementation(async () => ({ ...existing, status: 'CANCELLED', version: 4 })),
    acceptAlternative: jest.fn().mockImplementation(async (input: any) => ({ ...existing, status: 'DRAFT', vehicleId: input.alternativeVehicleId, documentsCompletedAt: null, confirmedAt: null, version: 4 })),
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
  const handler = new ResolveVehicleSaleHandler(reservations, saleResolutions, alternativeGuard, workContext, matrixAuth, audit, outbox, transactionManager);
  return { handler, reservations, saleResolutions, alternativeGuard, matrixAuth, audit, outbox, transactionManager };
}

describe('ResolveVehicleSaleHandler (UC-RES-004, RES-06/RES-07)', () => {
  describe('REJECT', () => {
    it('cancela con VEHICLE_SOLD_REFUND, deja el reembolso PENDING_TRANSFER y publica ReservationCancelled', async () => {
      const deps = buildDeps(buildRecord());

      const result = await deps.handler.execute(
        new ResolveVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 3, 'REJECT', undefined, 'No le interesa'),
      );

      expect(result.status).toBe('CANCELLED');
      expect(deps.matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'role-GERENCIA', 'RESERVATION', 'RESOLVE_SALE', expect.anything());
      expect(deps.saleResolutions.rejectSale).toHaveBeenCalledWith(
        { ...SCOPE, id: 'res-1', expectedVersion: 3, resolvedBy: 'uid-1', note: 'No le interesa' },
        FAKE_TX,
      );
      expect(deps.saleResolutions.acceptAlternative).not.toHaveBeenCalled();
      expect(deps.alternativeGuard.assertUsable).not.toHaveBeenCalled();
      expect(deps.transactionManager.run).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
      expect(deps.audit.recordReservationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESERVATION_SALE_REJECTED_CANCELLED',
          changes: expect.objectContaining({
            reason: 'VEHICLE_SOLD_REFUND',
            refund: { status: 'PENDING_TRANSFER', amount: '300.00', currency: 'PEN' },
          }),
        }),
        FAKE_TX,
      );
      expect(deps.outbox.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ReservationCancelled',
          payload: expect.objectContaining({ reason: 'VEHICLE_SOLD_REFUND', refund: expect.objectContaining({ status: 'PENDING_TRANSFER' }) }),
        }),
        FAKE_TX,
      );
    });
  });

  describe('ACCEPT_ALTERNATIVE', () => {
    it('usa la alternativa del comando, la valida, reformula (vuelve a DRAFT) y publica ReservationReformulated', async () => {
      const deps = buildDeps(buildRecord());

      const result = await deps.handler.execute(
        new ResolveVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 3, 'ACCEPT_ALTERNATIVE', 'veh-chosen'),
      );

      expect(deps.alternativeGuard.assertUsable).toHaveBeenCalledWith(expect.objectContaining({ id: 'res-1' }), 'veh-chosen', FAKE_TX);
      expect(deps.saleResolutions.acceptAlternative).toHaveBeenCalledWith(
        { ...SCOPE, id: 'res-1', expectedVersion: 3, resolvedBy: 'uid-1', alternativeVehicleId: 'veh-chosen', note: undefined },
        FAKE_TX,
      );
      expect(deps.saleResolutions.rejectSale).not.toHaveBeenCalled();
      expect(result.status).toBe('DRAFT');
      expect(result.vehicleId).toBe('veh-chosen');
      expect(result.paymentValidatedAt).not.toBeNull(); // el pago validado se conserva
      expect(result.documentsCompletedAt).toBeNull(); // hay que reenviar requisitos
      expect(deps.audit.recordReservationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESERVATION_SALE_ALTERNATIVE_ACCEPTED',
          changes: expect.objectContaining({ soldVehicleId: 'veh-1', alternativeVehicleId: 'veh-chosen', paymentKept: true }),
        }),
        FAKE_TX,
      );
      expect(deps.outbox.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'ReservationReformulated', payload: expect.objectContaining({ vehicleId: 'veh-chosen', soldVehicleId: 'veh-1' }) }),
        FAKE_TX,
      );
    });

    it('sin alternativa en el comando usa la ofrecida al registrar la venta', async () => {
      const deps = buildDeps(buildRecord());
      await deps.handler.execute(new ResolveVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 3, 'ACCEPT_ALTERNATIVE'));
      expect(deps.alternativeGuard.assertUsable).toHaveBeenCalledWith(expect.anything(), 'veh-offered', FAKE_TX);
    });

    it('422 ALTERNATIVE_VEHICLE_REQUIRED si no hay alternativa ni en el comando ni ofrecida', async () => {
      const deps = buildDeps(buildRecord(), 'GERENCIA', null);
      await expect(
        deps.handler.execute(new ResolveVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 3, 'ACCEPT_ALTERNATIVE')),
      ).rejects.toBeInstanceOf(AlternativeVehicleRequiredError);
      expect(deps.saleResolutions.acceptAlternative).not.toHaveBeenCalled();
    });

    it('409 VEHICLE_NOT_AVAILABLE si la alternativa ya no esta libre: no reformula ni audita', async () => {
      const deps = buildDeps(buildRecord());
      deps.alternativeGuard.assertUsable.mockRejectedValueOnce(new VehicleNotAvailableError());
      await expect(
        deps.handler.execute(new ResolveVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 3, 'ACCEPT_ALTERNATIVE', 'veh-2')),
      ).rejects.toBeInstanceOf(VehicleNotAvailableError);
      expect(deps.saleResolutions.acceptAlternative).not.toHaveBeenCalled();
      expect(deps.audit.recordReservationEvent).not.toHaveBeenCalled();
      expect(deps.outbox.publish).not.toHaveBeenCalled();
    });
  });

  it.each(['DRAFT', 'CONFIRMED', 'CONVERTED', 'CANCELLED'] as const)(
    'rechaza (409 RESERVATION_STATE_CONFLICT) si la reserva esta en %s: solo PENDING_SALE_RESOLUTION',
    async (status) => {
      const deps = buildDeps(buildRecord({ status }));
      await expect(
        deps.handler.execute(new ResolveVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 3, 'REJECT')),
      ).rejects.toBeInstanceOf(ReservationStateConflictError);
      expect(deps.saleResolutions.rejectSale).not.toHaveBeenCalled();
    },
  );

  it('404 si la reserva no existe en el scope completo', async () => {
    const deps = buildDeps(null);
    await expect(
      deps.handler.execute(new ResolveVehicleSaleCommand('res-x', 'uid-1', 'company-1', 'branch-1', 3, 'REJECT')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.reservations.findById).toHaveBeenCalledWith('res-x', SCOPE);
  });

  it('FRONT_OFFICE recibe ROLE_NOT_ALLOWED', async () => {
    const deps = buildDeps(buildRecord(), 'FRONT_OFFICE');
    await expect(
      deps.handler.execute(new ResolveVehicleSaleCommand('res-1', 'uid-1', 'company-1', 'branch-1', 3, 'REJECT')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
