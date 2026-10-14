import { PrismaFleetAvailabilityAdapter } from './prisma-fleet-availability.adapter';

const findFirstVehicleMock = jest.fn();
const findManyCommitmentMock = jest.fn();
const findManyReservationMock = jest.fn();

const prisma = {
  vehicle: { findFirst: findFirstVehicleMock },
  vehicleCommitment: { findMany: findManyCommitmentMock },
  reservation: { findMany: findManyReservationMock },
} as never;

const BASE_QUERY = {
  organizationId: 'org-1',
  operatingCompanyId: 'comp-1',
  branchId: 'branch-1',
  vehicleId: 'vehicle-1',
  destination: 'Cusco',
  estimatedDays: 3,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('PrismaFleetAvailabilityAdapter', () => {
  let adapter: PrismaFleetAvailabilityAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    findManyCommitmentMock.mockResolvedValue([]);
    findManyReservationMock.mockResolvedValue([]);
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
    expect(findManyCommitmentMock).not.toHaveBeenCalled();
  });

  it('devuelve inelegible cuando el vehículo está asignado a otra sede', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: 'branch-other', dailyRate: '100.00' });

    const result = await adapter.checkEligibility(BASE_QUERY);

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toMatch(/sede/i);
    }
    expect(findManyCommitmentMock).not.toHaveBeenCalled();
  });

  it('no verifica sede cuando el vehículo no tiene branchId (vehículo compartido)', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: null, dailyRate: '100.00' });

    const result = await adapter.checkEligibility(BASE_QUERY);

    expect(result.eligible).toBe(true);
  });

  it('devuelve inelegible cuando el vehículo no tiene dailyRate configurado en Flota', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: null, dailyRate: null });

    const result = await adapter.checkEligibility(BASE_QUERY);

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toMatch(/tarifa/i);
    }
    expect(findManyCommitmentMock).not.toHaveBeenCalled();
  });

  it('devuelve elegible cuando la sede del vehículo coincide y no hay compromisos ni reservas', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: 'branch-1', dailyRate: '250.00' });

    const result = await adapter.checkEligibility(BASE_QUERY);

    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.vehicleId).toBe('vehicle-1');
      expect(result.dailyRate).toBe('250.00');
    }
  });

  it('considera compromisos ACTIVE y CONSOLIDATED, y también reservas no terminales', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: null, dailyRate: '100.00' });

    await adapter.checkEligibility(BASE_QUERY);

    expect(findManyCommitmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vehicleId: { in: ['vehicle-1'] },
          status: { in: ['ACTIVE', 'CONSOLIDATED'] },
        }),
      }),
    );
    expect(findManyReservationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { notIn: ['CANCELLED', 'CONVERTED'] } }),
      }),
    );
  });

  it('devuelve inelegible con las fechas que chocan cuando hay un compromiso solapado', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: null, dailyRate: '100.00' });
    findManyCommitmentMock.mockResolvedValue([
      { vehicleId: 'vehicle-1', startsAt: new Date('2026-10-22T00:00:00Z'), endsAt: new Date('2026-10-28T00:00:00Z') },
    ]);

    const result = await adapter.checkEligibility({ ...BASE_QUERY, startsAt: new Date('2026-10-20T00:00:00Z') });

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toMatch(/no está disponible/i);
      expect(result.reason).toContain('20/10/2026 al 23/10/2026');
      // 22/10 00:00Z = 21/10 19:00 en Lima (DEC-TZ-LIMA-001).
      expect(result.reason).toContain('21/10/2026 al 27/10/2026');
    }
  });

  it('devuelve inelegible cuando choca con una reserva no terminal', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: null, dailyRate: '100.00' });
    findManyReservationMock.mockResolvedValue([
      { vehicleId: 'vehicle-1', startAt: new Date('2026-10-21T00:00:00Z'), endAt: new Date('2026-10-24T00:00:00Z') },
    ]);

    const result = await adapter.checkEligibility({ ...BASE_QUERY, startsAt: new Date('2026-10-20T00:00:00Z') });

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toContain('reserva');
      expect(result.reason).toContain('20/10/2026 al 23/10/2026');
    }
  });

  it('con travelStartDate usa la ventana [startsAt, startsAt + días) y no la fecha actual', async () => {
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: null, dailyRate: '100.00' });
    const startsAt = new Date('2027-01-10T00:00:00Z');

    const result = await adapter.checkEligibility({ ...BASE_QUERY, estimatedDays: 3, startsAt });

    expect(result.eligible).toBe(true);
    const call = findManyCommitmentMock.mock.calls[0][0] as {
      where: { startsAt: { lt: Date }; endsAt: { gt: Date } };
    };
    // travelStartDate (@db.Date, medianoche UTC) -> 00:00 America/Lima = 05:00Z.
    const limaStart = new Date('2027-01-10T05:00:00.000Z');
    expect(call.where.endsAt.gt).toEqual(limaStart);
    expect(call.where.startsAt.lt).toEqual(new Date(limaStart.getTime() + 3 * MS_PER_DAY));
  });

  it('sin fecha de viaje mantiene la ventana [ahora, ahora + días)', async () => {
    const before = new Date();
    findFirstVehicleMock.mockResolvedValue({ id: 'vehicle-1', branchId: null, dailyRate: '100.00' });

    await adapter.checkEligibility({ ...BASE_QUERY, estimatedDays: 3 });

    const after = new Date();
    const call = findManyCommitmentMock.mock.calls[0][0] as {
      where: { startsAt: { lt: Date }; endsAt: { gt: Date } };
    };
    const { startsAt, endsAt } = call.where;

    expect(endsAt.gt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(endsAt.gt.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(startsAt.lt.getTime() - endsAt.gt.getTime()).toBe(3 * MS_PER_DAY);
  });
});
