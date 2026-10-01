import { PrismaFleetAvailabilityAdapter } from './prisma-fleet-availability.adapter';

const findFirstVehicleMock = jest.fn();
const findFirstCommitmentMock = jest.fn();

const prisma = {
  vehicle: { findFirst: findFirstVehicleMock },
  vehicleCommitment: { findFirst: findFirstCommitmentMock },
} as never;

const BASE_QUERY = {
  organizationId: 'org-1',
  operatingCompanyId: 'comp-1',
  branchId: 'branch-1',
  vehicleId: 'vehicle-1',
  destination: 'Cusco',
  estimatedDays: 3,
};

describe('PrismaFleetAvailabilityAdapter', () => {
  let adapter: PrismaFleetAvailabilityAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new PrismaFleetAvailabilityAdapter(prisma);
  });

  it('productionReady es true', () => {
    expect(adapter.productionReady).toBe(true);
  });

  it('devuelve inelegible cuando el vehículo no existe en la empresa', async () => {
    findFirstVehicleMock.mockResolvedValue(null);

    const result = await adapter.checkEligibility(BASE_QUERY);

    expect(result.eligible).toBe(false);
    expect(findFirstVehicleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'vehicle-1',
          organizationId: 'org-1',
          operatingCompanyId: 'comp-1',
        },
      }),
    );
    expect(findFirstCommitmentMock).not.toHaveBeenCalled();
  });

  it('devuelve inelegible cuando el vehículo está asignado a otra sede', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: 'branch-other' });

    const result = await adapter.checkEligibility(BASE_QUERY);

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toMatch(/sede/i);
    }
    expect(findFirstCommitmentMock).not.toHaveBeenCalled();
  });

  it('no verifica sede cuando el vehículo no tiene branchId (vehículo compartido)', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: null });
    findFirstCommitmentMock.mockResolvedValue(null);

    const result = await adapter.checkEligibility(BASE_QUERY);

    expect(result.eligible).toBe(true);
  });

  it('devuelve elegible cuando la sede del vehículo coincide y no hay compromisos activos', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: 'branch-1' });
    findFirstCommitmentMock.mockResolvedValue(null);

    const result = await adapter.checkEligibility(BASE_QUERY);

    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.vehicleId).toBe('vehicle-1');
    }
  });

  it('consulta compromisos solo con status ACTIVE', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: null });
    findFirstCommitmentMock.mockResolvedValue(null);

    await adapter.checkEligibility(BASE_QUERY);

    expect(findFirstCommitmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vehicleId: 'vehicle-1',
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('devuelve inelegible cuando existe un compromiso ACTIVE que solapa', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: null });
    findFirstCommitmentMock.mockResolvedValue({ id: 'commit-1' });

    const result = await adapter.checkEligibility(BASE_QUERY);

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toMatch(/disponible/i);
    }
  });

  it('la query de solapamiento incluye startsAt:lt y endsAt:gt con el período correcto', async () => {
    const before = new Date();

    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: null });
    findFirstCommitmentMock.mockResolvedValue(null);

    await adapter.checkEligibility({ ...BASE_QUERY, estimatedDays: 3 });

    const after = new Date();

    const call = findFirstCommitmentMock.mock.calls[0][0] as {
      where: { startsAt: { lt: Date }; endsAt: { gt: Date } };
    };
    const { startsAt, endsAt } = call.where;

    // endsAt.gt debe estar entre [before, after]
    expect(endsAt.gt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(endsAt.gt.getTime()).toBeLessThanOrEqual(after.getTime());

    // startsAt.lt debe estar ~3 días después de now
    const expectedMs = 3 * 24 * 60 * 60 * 1000;
    expect(startsAt.lt.getTime() - endsAt.gt.getTime()).toBeCloseTo(expectedMs, -3);
  });

  it('compromisos con status RELEASED no bloquean la elegibilidad', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: null });
    // findFirst returns null because the WHERE filters status = ACTIVE
    findFirstCommitmentMock.mockResolvedValue(null);

    const result = await adapter.checkEligibility(BASE_QUERY);

    expect(result.eligible).toBe(true);
  });
});
