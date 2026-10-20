import { addDays, assertLocalDatabaseUrl, assertNotProduction, buildDemoDataset, DEMO_RESERVATION_AMOUNT, demoId, limaCalendarDate, parseEnvFile } from './seed-demo.lib';

const ctx = { organizationId: 'org-1', companyId: 'c0c0c0c0-0000-4000-8000-000000000001', branchId: 'b0b0b0b0-0000-4000-8000-000000000001', now: new Date('2026-10-19T15:00:00Z') };

describe('seed-demo.lib guardas', () => {
  it('rechaza NODE_ENV=production', () => {
    expect(() => assertNotProduction({ NODE_ENV: 'production' })).toThrow(/production/);
    expect(() => assertNotProduction({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertNotProduction({})).not.toThrow();
  });

  it('acepta solo hosts locales', () => {
    expect(() => assertLocalDatabaseUrl('DATABASE_URL', 'postgresql://kairos:x@localhost:5434/kairos_dev')).not.toThrow();
    expect(() => assertLocalDatabaseUrl('DATABASE_URL', 'postgres://u:p@127.0.0.1:5432/db?schema=public')).not.toThrow();
    expect(() => assertLocalDatabaseUrl('DATABASE_URL', 'postgresql://u:p@[::1]:5432/db')).not.toThrow();
  });

  it.each([
    undefined,
    '',
    'postgresql://u:p@db.example.com:5432/db',
    'postgresql://u:p@localhost.evil.com:5432/db',
    'postgresql://u:p@localhost:5432/db?host=prod.example.com',
    'postgresql://u:p@localhost,prod.example.com:5432/db',
    'mysql://u:p@localhost:3306/db',
    'no-es-una-url',
  ])('rechaza %p', (url) => {
    expect(() => assertLocalDatabaseUrl('DATABASE_URL', url)).toThrow();
  });

  it('parseEnvFile lee claves con y sin comillas e ignora comentarios', () => {
    const env = parseEnvFile('# c\nDATABASE_URL="postgresql://a@localhost/db"\nPORT=3001 # nota\nexport X=\'y\'\nbasura');
    expect(env).toEqual({ DATABASE_URL: 'postgresql://a@localhost/db', PORT: '3001', X: 'y' });
  });
});

describe('seed-demo.lib datos', () => {
  const data = buildDemoDataset(ctx);

  it('demoId es determinista, con forma de UUID y distinto por clave y por empresa', () => {
    expect(demoId('a', 'k')).toBe(demoId('a', 'k'));
    expect(demoId('a', 'k')).not.toBe(demoId('a', 'k2'));
    expect(demoId('a', 'k')).not.toBe(demoId('b', 'k'));
    expect(demoId('a', 'k')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('es determinista entre ejecuciones (idempotencia por id)', () => {
    expect(buildDemoDataset(ctx).vehicles.map((v) => v.id)).toEqual(data.vehicles.map((v) => v.id));
  });

  it('ids y claves unicas dentro del conjunto', () => {
    for (const rows of [data.customers, data.vehicles, data.employees, data.reservations, data.rentals, data.hrAreas]) {
      const ids = rows.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(new Set(data.vehicles.map((v) => v.plate)).size).toBe(data.vehicles.length);
    expect(new Set(data.customers.map((c) => `${c.documentType}:${c.documentNumber}`)).size).toBe(data.customers.length);
    expect(new Set(data.employees.map((e) => e.documentNumber)).size).toBe(data.employees.length);
  });

  it('todo dato visible lleva la marca DEMO y no hay correos reales', () => {
    expect(data.customers.every((c) => c.fullName.includes('DEMO'))).toBe(true);
    expect(data.employees.every((e) => e.fullName.includes('DEMO'))).toBe(true);
    expect(data.vehicles.every((v) => v.plate.startsWith('DEM-') && v.model.includes('DEMO'))).toBe(true);
    expect(data.customers.every((c) => !c.email || c.email.endsWith('@example.invalid'))).toBe(true);
  });

  it('vehiculos: garantia/combustible/capacidad cubren los casos de la guia', () => {
    const byPlate = new Map(data.vehicles.map((v) => [v.plate, v]));
    expect(byPlate.get('DEM-101')?.passengerCapacity).toBe(5);
    expect(byPlate.get('DEM-103')?.passengerCapacity).toBe(2);
    expect(byPlate.get('DEM-104')?.passengerCapacity).toBeNull();
    expect(Number(byPlate.get('DEM-105')?.depositMinimum)).toBeLessThan(Number(DEMO_RESERVATION_AMOUNT));
    expect(data.vehicles.every((v) => Number(v.fuelPrice) > 0 && Number(v.depositMinimum) > 0)).toBe(true);
  });

  it('la reserva confirmada respeta la garantia del vehiculo y tiene compromiso consolidado', () => {
    const confirmed = data.reservations.find((r) => r.status === 'CONFIRMED');
    const vehicle = data.vehicles.find((v) => v.id === confirmed?.vehicleId);
    expect(Number(vehicle?.depositMinimum)).toBeGreaterThanOrEqual(Number(DEMO_RESERVATION_AMOUNT));
    expect(data.vehicleCommitments.some((c) => c.sourceId === confirmed?.id && c.status === 'CONSOLIDATED')).toBe(true);
  });

  it('alquileres: con retraso, con conductor de la empresa (sin garantia) y vehiculos RENTED', () => {
    const late = data.rentals.find((r) => r.expectedEndAt instanceof Date && r.expectedEndAt < ctx.now);
    expect(late?.status).toBe('ACTIVE');
    const driver = data.rentals.find((r) => r.companyDriverDailyRate != null);
    expect(driver).toBeDefined();
    expect(data.rentalDeposits.some((d) => d.rentalId === driver?.id)).toBe(false);
    expect(data.rentalContracts.find((c) => c.rentalId === driver?.id)?.depositRequired).toBe(false);
    for (const rental of data.rentals.filter((r) => r.status === 'ACTIVE')) {
      expect(data.vehicles.find((v) => v.id === rental.vehicleId)?.status).toBe('RENTED');
    }
  });

  it('el catalogo de areas coincide con las 7 areas documentadas y los empleados usan areas del catalogo', () => {
    const codes = new Set(data.hrAreas.map((a) => a.code));
    expect(codes.size).toBe(7);
    expect(data.employees.every((e) => codes.has(e.areaId))).toBe(true);
    expect(data.employees.filter((e) => e.areaId === 'OPERACIONES').length).toBeGreaterThanOrEqual(2);
  });

  it('fechas: limaCalendarDate usa el dia de Lima', () => {
    expect(limaCalendarDate(new Date('2026-10-20T03:00:00Z')).toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(addDays(ctx.now, 1).getTime() - ctx.now.getTime()).toBe(86_400_000);
  });
});
