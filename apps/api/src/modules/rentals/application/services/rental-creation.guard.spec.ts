import { RentalCreationGuard } from './rental-creation.guard';
import { RentalRepositoryPort } from '../ports/rental-repository.port';
import { CustomerBlockedError, VehicleNotAvailableForRentalError } from '../../domain/rental-errors';

const NOW = new Date('2026-10-05T15:00:00Z');

function build(overlap = false) {
  const rentals = { hasBlockingVehicleCommitment: jest.fn().mockResolvedValue(overlap) } as unknown as jest.Mocked<RentalRepositoryPort>;
  return { rentals, guard: new RentalCreationGuard(rentals, { now: () => NOW }) };
}

const vehicle = { id: 'veh-1', organizationId: 'org-1', branchId: 'b-1' as string | null, status: 'AVAILABLE' };

describe('RentalCreationGuard', () => {
  describe('assertCustomerNotBlocked', () => {
    it('ROJO bloquea (CUSTOMER_BLOCKED)', () => {
      expect(() => build().guard.assertCustomerNotBlocked({ status: 'ROJO' })).toThrow(CustomerBlockedError);
    });
    it.each(['NORMAL', 'AMBAR'])('%s no bloquea (el ambar es "cliente observado", sigue activo)', (status) => {
      expect(() => build().guard.assertCustomerNotBlocked({ status })).not.toThrow();
    });
  });

  describe('resolveWindow', () => {
    const { guard } = build();
    it('usa fechas explicitas', () => {
      const startAt = new Date('2026-11-01T00:00:00Z');
      const expectedEndAt = new Date('2026-11-04T00:00:00Z');
      expect(guard.resolveWindow({ startAt, expectedEndAt })).toEqual({ startsAt: startAt, endsAt: expectedEndAt });
    });
    it('ahora + dias estimados si no hay fin', () => {
      expect(guard.resolveWindow({ estimatedDays: 2 })).toEqual({ startsAt: NOW, endsAt: new Date('2026-10-07T15:00:00Z') });
    });
    it('sin fin ni duracion valida solo el instante de inicio', () => {
      const { startsAt, endsAt } = guard.resolveWindow({});
      expect(startsAt).toEqual(NOW);
      expect(endsAt.getTime() - startsAt.getTime()).toBe(1);
    });
  });

  describe('assertVehicleAvailable', () => {
    const window = { startsAt: NOW, endsAt: new Date('2026-10-08T15:00:00Z') };

    it('disponible, misma sede y sin solape -> ok', async () => {
      const { guard, rentals } = build();
      await expect(guard.assertVehicleAvailable(vehicle, 'b-1', window)).resolves.toBeUndefined();
      expect(rentals.hasBlockingVehicleCommitment).toHaveBeenCalledWith('veh-1', 'org-1', window.startsAt, window.endsAt, undefined);
    });
    it('vehiculo sin sede (compartido) -> ok', async () => {
      await expect(build().guard.assertVehicleAvailable({ ...vehicle, branchId: null }, 'b-9', window)).resolves.toBeUndefined();
    });
    it.each(['RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE'])('estado %s -> STATUS', async (status) => {
      await expect(build().guard.assertVehicleAvailable({ ...vehicle, status }, 'b-1', window)).rejects.toMatchObject({
        code: 'VEHICLE_NOT_AVAILABLE',
        extra: { reason: 'STATUS' },
      });
    });
    it('otra sede -> BRANCH', async () => {
      await expect(build().guard.assertVehicleAvailable(vehicle, 'b-2', window)).rejects.toMatchObject({ extra: { reason: 'BRANCH' } });
    });
    it('compromiso solapado -> COMMITMENT_OVERLAP', async () => {
      await expect(build(true).guard.assertVehicleAvailable(vehicle, 'b-1', window)).rejects.toBeInstanceOf(VehicleNotAvailableForRentalError);
    });
  });
});
