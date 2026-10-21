import {
  assertLocalDatabaseUrl,
  assertNotProduction,
  buildDemoDataset,
  DEMO_RESERVATION_AMOUNT,
  limaCalendarDate,
} from '../../prisma/seed-demo.lib';

describe('seed demo local', () => {
  const context = {
    organizationId: 'org-1',
    companyId: 'c0c0c0c0-0000-4000-8000-000000000001',
    branchId: 'b0b0b0b0-0000-4000-8000-000000000001',
    now: new Date('2026-10-19T15:00:00Z'),
  };

  it('nunca permite ejecutar el seed contra produccion o una base remota', () => {
    expect(() => assertNotProduction({ NODE_ENV: 'production' })).toThrow(/production/);
    expect(() => assertLocalDatabaseUrl('DATABASE_URL', 'postgresql://kairos:x@db.example.com/kairos')).toThrow();
    expect(() => assertLocalDatabaseUrl('DATABASE_URL', 'postgresql://kairos:x@localhost/kairos')).not.toThrow();
  });

  it('genera datos DEMO coherentes para las reglas de garantia y capacidad', () => {
    const dataset = buildDemoDataset(context);
    const confirmed = dataset.reservations.find((reservation) => reservation.status === 'CONFIRMED');
    const vehicle = dataset.vehicles.find((item) => item.id === confirmed?.vehicleId);

    expect(Number(vehicle?.depositMinimum)).toBeGreaterThanOrEqual(Number(DEMO_RESERVATION_AMOUNT));
    expect(dataset.vehicles.find((item) => item.plate === 'DEM-103')?.passengerCapacity).toBe(2);
    expect(limaCalendarDate(new Date('2026-10-20T03:00:00Z')).toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });
});
