import { ProvisionalFleetAvailabilityAdapter } from './provisional-fleet-availability.adapter';

const QUERY = {
  organizationId: 'org-1',
  operatingCompanyId: 'company-1',
  branchId: 'branch-1',
  vehicleId: 'veh-1',
  destination: 'Vilcashuaman',
  estimatedDays: 3,
};

describe('ProvisionalFleetAvailabilityAdapter', () => {
  it('busca el vehiculo por organizacion Y empresa (aislamiento cross-company)', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'veh-1' });
    const adapter = new ProvisionalFleetAvailabilityAdapter({ vehicle: { findFirst } } as any);

    await expect(adapter.checkEligibility(QUERY)).resolves.toEqual({ eligible: true, vehicleId: 'veh-1' });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'veh-1', organizationId: 'org-1', operatingCompanyId: 'company-1' },
      select: { id: true },
    });
  });

  it('un vehiculo de otra empresa (no encontrado bajo el scope) no es elegible', async () => {
    const adapter = new ProvisionalFleetAvailabilityAdapter({ vehicle: { findFirst: jest.fn().mockResolvedValue(null) } } as any);

    await expect(adapter.checkEligibility(QUERY)).resolves.toEqual(expect.objectContaining({ eligible: false }));
  });

  it('se declara NO apto para produccion', () => {
    expect(new ProvisionalFleetAvailabilityAdapter({} as any).productionReady).toBe(false);
  });
});
