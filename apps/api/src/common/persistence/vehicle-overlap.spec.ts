import { findFirstVehicleConflict, findVehicleConflicts, formatDateDMY } from './vehicle-overlap';

const FROM = new Date('2026-10-20T00:00:00.000Z');
const TO = new Date('2026-10-25T00:00:00.000Z');

function build(commitments: unknown[] = [], reservations: unknown[] = []) {
  const client = {
    vehicleCommitment: { findMany: jest.fn().mockResolvedValue(commitments) },
    reservation: { findMany: jest.fn().mockResolvedValue(reservations) },
  };
  return client;
}

describe('findVehicleConflicts', () => {
  it('detecta conflicto con un vehicle_commitment ACTIVE|CONSOLIDATED que solapa', async () => {
    const client = build([{ vehicleId: 'v1', startsAt: new Date('2026-10-22T00:00:00Z'), endsAt: new Date('2026-10-28T00:00:00Z') }]);

    const map = await findVehicleConflicts(client as never, ['v1'], FROM, TO);

    expect(map.get('v1')).toEqual({
      vehicleId: 'v1',
      from: new Date('2026-10-22T00:00:00Z'),
      to: new Date('2026-10-28T00:00:00Z'),
      source: 'COMMITMENT',
    });
    expect(client.vehicleCommitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vehicleId: { in: ['v1'] },
          status: { in: ['ACTIVE', 'CONSOLIDATED'] },
          startsAt: { lt: TO },
          endsAt: { gt: FROM },
        },
      }),
    );
    // Ya hay conflicto de compromiso: no hace falta consultar reservas para ese vehiculo.
    expect(client.reservation.findMany).not.toHaveBeenCalled();
  });

  it('detecta conflicto con una reserva no terminal y excluye CANCELLED/CONVERTED', async () => {
    const client = build([], [{ vehicleId: 'v1', startAt: new Date('2026-10-18T00:00:00Z'), endAt: new Date('2026-10-21T00:00:00Z') }]);

    const map = await findVehicleConflicts(client as never, ['v1'], FROM, TO);

    expect(map.get('v1')).toMatchObject({ source: 'RESERVATION', from: new Date('2026-10-18T00:00:00Z'), to: new Date('2026-10-21T00:00:00Z') });
    expect(client.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vehicleId: { in: ['v1'] },
          status: { notIn: ['CANCELLED', 'CONVERTED'] },
          startAt: { lt: TO },
          endAt: { gt: FROM },
        },
      }),
    );
  });

  it('ventana sin conflicto: el mapa queda vacio', async () => {
    const client = build();

    const map = await findVehicleConflicts(client as never, ['v1', 'v2'], FROM, TO);

    expect(map.size).toBe(0);
  });

  it('calcula en lote: una query por fuente y solo consulta reservas de los vehiculos sin compromiso', async () => {
    const client = build(
      [{ vehicleId: 'v1', startsAt: FROM, endsAt: TO }],
      [{ vehicleId: 'v2', startAt: FROM, endAt: TO }],
    );

    const map = await findVehicleConflicts(client as never, ['v1', 'v2', 'v3', 'v1'], FROM, TO);

    expect(client.vehicleCommitment.findMany).toHaveBeenCalledTimes(1);
    expect(client.reservation.findMany).toHaveBeenCalledTimes(1);
    expect(client.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ vehicleId: { in: ['v2', 'v3'] } }) }),
    );
    expect(map.get('v1')?.source).toBe('COMMITMENT');
    expect(map.get('v2')?.source).toBe('RESERVATION');
    expect(map.has('v3')).toBe(false);
  });

  it('excludeReservationId se traduce a id: { not } en la consulta de reservas', async () => {
    const client = build();

    await findVehicleConflicts(client as never, ['v1'], FROM, TO, { excludeReservationId: 'res-1' });

    expect(client.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: 'res-1' } }) }),
    );
  });

  it('sin vehiculos no consulta la base', async () => {
    const client = build();

    const map = await findVehicleConflicts(client as never, [], FROM, TO);

    expect(map.size).toBe(0);
    expect(client.vehicleCommitment.findMany).not.toHaveBeenCalled();
  });
});

describe('findFirstVehicleConflict', () => {
  it('devuelve null si esta libre y el conflicto si no', async () => {
    expect(await findFirstVehicleConflict(build() as never, 'v1', FROM, TO)).toBeNull();
    const busy = build([{ vehicleId: 'v1', startsAt: FROM, endsAt: TO }]);
    expect(await findFirstVehicleConflict(busy as never, 'v1', FROM, TO)).toMatchObject({ source: 'COMMITMENT' });
  });
});

describe('formatDateDMY', () => {
  it('formatea dd/mm/yyyy en UTC', () => {
    expect(formatDateDMY(new Date('2026-03-05T00:00:00Z'))).toBe('05/03/2026');
  });
});
