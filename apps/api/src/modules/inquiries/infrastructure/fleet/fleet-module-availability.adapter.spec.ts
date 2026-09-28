import { FleetModuleAvailabilityAdapter } from './fleet-module-availability.adapter';
import { FleetVehicleRepositoryPort } from '../../../fleet/application/ports/fleet-vehicle-repository.port';
import { buildFleetVehicle } from '../../../fleet/testing/fleet-test-fixtures';

const QUERY = {
  organizationId: 'org-1',
  operatingCompanyId: 'company-1',
  branchId: 'branch-1',
  vehicleId: 'veh-1',
  destination: 'Vilcashuaman',
  estimatedDays: 3,
};

function buildRepo(findById: jest.Mock): jest.Mocked<FleetVehicleRepositoryPort> {
  return { findById } as unknown as jest.Mocked<FleetVehicleRepositoryPort>;
}

describe('FleetModuleAvailabilityAdapter', () => {
  it('busca el vehiculo por organizacion Y empresa (aislamiento cross-company)', async () => {
    const findById = jest.fn().mockResolvedValue(buildFleetVehicle({ id: 'veh-1', status: 'AVAILABLE' }));
    const adapter = new FleetModuleAvailabilityAdapter(buildRepo(findById));

    await expect(adapter.checkEligibility(QUERY)).resolves.toEqual({ eligible: true, vehicleId: 'veh-1' });
    expect(findById).toHaveBeenCalledWith('veh-1', { organizationId: 'org-1', operatingCompanyId: 'company-1' });
  });

  it('un vehiculo de otra empresa (no encontrado bajo el scope) no es elegible', async () => {
    const adapter = new FleetModuleAvailabilityAdapter(buildRepo(jest.fn().mockResolvedValue(null)));

    await expect(adapter.checkEligibility(QUERY)).resolves.toEqual(
      expect.objectContaining({ eligible: false }),
    );
  });

  it('un vehiculo que no esta AVAILABLE no es elegible', async () => {
    const findById = jest.fn().mockResolvedValue(buildFleetVehicle({ id: 'veh-1', status: 'RENTED' }));
    const adapter = new FleetModuleAvailabilityAdapter(buildRepo(findById));

    await expect(adapter.checkEligibility(QUERY)).resolves.toEqual(
      expect.objectContaining({ eligible: false }),
    );
  });

  it('se declara apto para produccion', () => {
    expect(new FleetModuleAvailabilityAdapter({} as any).productionReady).toBe(true);
  });
});
