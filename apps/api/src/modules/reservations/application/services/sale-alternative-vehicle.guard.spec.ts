import { SaleAlternativeVehicleGuard } from './sale-alternative-vehicle.guard';
import { ReservationSaleResolutionRepositoryPort } from '../ports/reservation-sale-resolution-repository.port';
import { ReservationRecord } from '../ports/reservation-repository.port';
import { AlternativeVehicleInvalidError } from '../../domain/reservation-sale-resolution';
import { VehicleNotAvailableError } from '../../domain/reservation-errors';

const RESERVATION = {
  id: 'res-1', organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1', vehicleId: 'veh-1',
  startAt: new Date('2026-10-20T14:00:00Z'), endAt: new Date('2026-10-22T14:00:00Z'),
} as ReservationRecord;

function build(vehicle: any, conflict: any = null) {
  const repo = {
    findVehicleById: jest.fn().mockResolvedValue(vehicle),
    findVehicleConflict: jest.fn().mockResolvedValue(conflict),
  } as unknown as jest.Mocked<ReservationSaleResolutionRepositoryPort>;
  return { repo, guard: new SaleAlternativeVehicleGuard(repo) };
}

const OK_VEHICLE = { id: 'veh-2', organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1', status: 'AVAILABLE', plate: 'AAA-111' };

describe('SaleAlternativeVehicleGuard', () => {
  it('acepta un vehiculo de la empresa, disponible y libre en la ventana (excluyendo la propia reserva)', async () => {
    const { repo, guard } = build(OK_VEHICLE);
    await expect(guard.assertUsable(RESERVATION, 'veh-2')).resolves.toBeUndefined();
    expect(repo.findVehicleConflict).toHaveBeenCalledWith('veh-2', RESERVATION.startAt, RESERVATION.endAt, 'res-1', undefined);
  });

  it('acepta un vehiculo compartido entre sedes (branchId null)', async () => {
    const { guard } = build({ ...OK_VEHICLE, branchId: null });
    await expect(guard.assertUsable(RESERVATION, 'veh-2')).resolves.toBeUndefined();
  });

  it('rechaza el mismo vehiculo vendido', async () => {
    const { repo, guard } = build(OK_VEHICLE);
    await expect(guard.assertUsable(RESERVATION, 'veh-1')).rejects.toBeInstanceOf(AlternativeVehicleInvalidError);
    expect(repo.findVehicleById).not.toHaveBeenCalled();
  });

  it.each([
    ['no existe', null],
    ['es de otra empresa', { ...OK_VEHICLE, operatingCompanyId: 'company-9' }],
    ['es de otra organizacion', { ...OK_VEHICLE, organizationId: 'org-9' }],
    ['es de otra sede', { ...OK_VEHICLE, branchId: 'branch-9' }],
    ['no esta AVAILABLE', { ...OK_VEHICLE, status: 'MAINTENANCE' }],
  ])('rechaza (422) si el vehiculo %s', async (_label, vehicle) => {
    const { guard } = build(vehicle);
    await expect(guard.assertUsable(RESERVATION, 'veh-2')).rejects.toBeInstanceOf(AlternativeVehicleInvalidError);
  });

  it('409 VEHICLE_NOT_AVAILABLE si solapa con un compromiso o reserva', async () => {
    const { guard } = build(OK_VEHICLE, { from: new Date('2026-10-21T00:00:00Z'), to: new Date('2026-10-23T00:00:00Z') });
    await expect(guard.assertUsable(RESERVATION, 'veh-2')).rejects.toBeInstanceOf(VehicleNotAvailableError);
  });
});
