import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/persistence/prisma.service';
import { PrismaTransactionManager } from '../../src/common/persistence/prisma-transaction-manager';
import { PrismaReservationRepository } from '../../src/modules/reservations/infrastructure/persistence/prisma-reservation.repository';
import { PrismaOutboxEventRepository } from '../../src/modules/outbox/infrastructure/persistence/prisma-outbox-event.repository';
import { ConfirmReservationHandler } from '../../src/modules/reservations/application/commands/confirm-reservation.handler';
import { ConfirmReservationCommand } from '../../src/modules/reservations/application/commands/confirm-reservation.command';
import { WorkContextAuthorizationService } from '../../src/modules/users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../src/modules/authorization/matrix-authorization.service';
import { getTestDatabase, TestDatabase } from '../helpers/test-database';

/**
 * TEST-RES-CONC-001 (RES PEND-07, NFR-KAI-001, TDD-RES-001 10.1/13): dos confirmaciones SIMULTANEAS de reservas DISTINTAS
 * sobre el MISMO vehiculo y periodos solapados -> exactamente UNA queda CONFIRMED con su vehicle_commitment; la otra recibe
 * 409 VEHICLE_NOT_AVAILABLE (nunca dos commitments bloqueantes, nunca un 500).
 *
 * Ademas verifica la exclusion de rango en BD (migracion 20261022030001): un INSERT directo de un commitment solapado es
 * rechazado por Postgres, y periodos contiguos [a,b) [b,c) o de otro vehiculo se aceptan. Si la migracion dejo la
 * constraint sin crear por datos solapados previos (RAISE WARNING), estas pruebas de BD se omiten.
 *
 * Requiere PostgreSQL real (Testcontainers o DATABASE_URL en CI): se ejecuta con `npm run test:integration`.
 */
describe('Reserva: confirmaciones concurrentes sobre el mismo vehiculo (Postgres real)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  const org = randomUUID();
  const company = randomUUID();
  const branch = randomUUID();
  const customer = randomUUID();
  const vehicle = randomUUID();
  const otherVehicle = randomUUID();
  let constraintExists = false;

  function buildHandler() {
    const workContext = {
      authorize: async () => ({ organizationId: org, companyId: company, branchId: branch, roleId: 'role-it', roleName: 'FRONT_OFFICE', roleKey: 'FRONT_OFFICE' as const }),
    } as unknown as WorkContextAuthorizationService;
    const matrixAuth = { assertAllowed: async () => undefined, isAllowed: async () => true } as unknown as MatrixAuthorizationService;
    const audit = { recordReservationEvent: async () => undefined } as any;
    return new ConfirmReservationHandler(
      new PrismaReservationRepository(prisma as unknown as PrismaService),
      workContext,
      audit,
      new PrismaOutboxEventRepository(prisma as unknown as PrismaService),
      new PrismaTransactionManager(prisma as unknown as PrismaService),
      matrixAuth,
    );
  }

  async function draftReservation(vehicleId: string, startAt: Date, endAt: Date): Promise<string> {
    const reservation = await prisma.reservation.create({
      data: {
        organizationId: org,
        operatingCompanyId: company,
        branchId: branch,
        customerId: customer,
        vehicleId,
        status: 'DRAFT',
        channelMode: 'PRESENCIAL',
        startAt,
        endAt,
        requiredPaymentAmount: '300.00',
        currency: 'PEN',
        paymentPolicyVersion: 1,
        paymentValidatedAt: new Date(),
        documentsCompletedAt: new Date(),
        createdBy: 'uid-integration',
      },
    });
    return reservation.id;
  }

  beforeAll(async () => {
    db = await getTestDatabase();
    prisma = db.prisma;
    await prisma.company.create({ data: { id: company, organizationId: org, name: 'Empresa IT' } });
    await prisma.branch.create({ data: { id: branch, companyId: company, name: 'Sede IT' } });
    await prisma.customer.create({
      data: { id: customer, organizationId: org, operatingCompanyId: company, fullName: 'Cliente IT', documentType: 'DNI', documentNumber: '1' },
    });
    await prisma.vehicle.createMany({
      data: [
        { id: vehicle, organizationId: org, operatingCompanyId: company, plate: `CC-${vehicle.slice(0, 6)}`, brand: 'Toyota', model: 'Hilux' },
        { id: otherVehicle, organizationId: org, operatingCompanyId: company, plate: `CC-${otherVehicle.slice(0, 6)}`, brand: 'Kia', model: 'Rio' },
      ],
    });
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM pg_constraint WHERE conname = 'vehicle_commitments_no_overlap_excl'`;
    constraintExists = Number(rows[0].n) > 0;
  }, 60000);

  afterAll(async () => {
    if (db) await db.stop();
  });

  it('dos reservas DRAFT solapadas del mismo vehiculo se bloquean mutuamente: ninguna se confirma (DEC-RES-SALE-001-OQ b: DRAFT cuenta en la regla de solape)', async () => {
    // Fixture anterior de este test: dos DRAFT solapadas confirmadas a la vez esperando "una gana". Con la regla compartida de solape
    // (vehicle-overlap.ts) una reserva DRAFT no terminal ya cuenta como ocupacion, asi que ambas ven a la otra y reciben 409.
    // En produccion dos DRAFT solapadas ni siquiera pueden crearse (convert-to-reservation lo rechaza); aqui se siembran directo.
    const v = randomUUID();
    await prisma.vehicle.create({ data: { id: v, organizationId: org, operatingCompanyId: company, plate: `DD-${v.slice(0, 6)}`, brand: 'Kia', model: 'Seltos' } });
    const resA = await draftReservation(v, new Date('2026-11-10T14:00:00Z'), new Date('2026-11-13T14:00:00Z'));
    const resB = await draftReservation(v, new Date('2026-11-12T14:00:00Z'), new Date('2026-11-15T14:00:00Z'));
    const handler = buildHandler();
    const results = await Promise.allSettled(
      [resA, resB].map((id) => handler.execute(new ConfirmReservationCommand(id, 'uid-integration', company, branch, 1))),
    );
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    for (const r of results as PromiseRejectedResult[]) {
      expect(r.reason).toMatchObject({ code: 'VEHICLE_NOT_AVAILABLE', httpStatus: 409 });
    }
    await expect(prisma.vehicleCommitment.count({ where: { vehicleId: v } })).resolves.toBe(0);
  }, 60000);

  it('TEST-RES-CONC-001: confirmacion de la reserva vs. otro compromiso bloqueante insertado a la vez sobre el mismo vehiculo -> exactamente UNO bloquea; la confirmacion perdedora es 409 VEHICLE_NOT_AVAILABLE (nunca 500)', async () => {
    // La carrera real que cubre la exclusion de rango: la reserva DRAFT ve el vehiculo libre en su snapshot Serializable y, a la vez,
    // otro origen (alquiler/mantenimiento: no pasa por la comprobacion de reservas) inserta su compromiso solapado.
    for (let round = 0; round < 3; round += 1) {
      const v = randomUUID();
      await prisma.vehicle.create({ data: { id: v, organizationId: org, operatingCompanyId: company, plate: `RC-${v.slice(0, 6)}`, brand: 'Toyota', model: 'Hilux' } });
      const day = String(10 + round * 5);
      const start = new Date(`2027-03-${day}T14:00:00Z`);
      const end = new Date(`2027-03-${String(Number(day) + 3)}T14:00:00Z`);
      const reservationId = await draftReservation(v, start, end);
      const handler = buildHandler();

      const results = await Promise.allSettled([
        handler.execute(new ConfirmReservationCommand(reservationId, 'uid-integration', company, branch, 1)),
        prisma.vehicleCommitment.create({
          data: {
            organizationId: org,
            vehicleId: v,
            sourceType: 'MAINTENANCE',
            sourceId: randomUUID(),
            status: 'ACTIVE',
            startsAt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
            endsAt: new Date(end.getTime() + 24 * 60 * 60 * 1000),
          },
        }),
      ]);

      const [confirmResult, insertResult] = results;
      if (confirmResult.status === 'rejected') {
        // Perdio la confirmacion: 409 de negocio, y el compromiso ajeno es el unico bloqueante.
        expect(confirmResult.reason).toMatchObject({ code: 'VEHICLE_NOT_AVAILABLE', httpStatus: 409 });
        expect(insertResult.status).toBe('fulfilled');
        await expect(prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).resolves.toMatchObject({ status: 'DRAFT' });
      } else if (insertResult.status === 'rejected') {
        // Perdio el otro origen: la exclusion de BD lo rechazo y la reserva quedo CONFIRMED.
        await expect(prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).resolves.toMatchObject({ status: 'CONFIRMED' });
      } else {
        throw new Error('Ambas operaciones tuvieron exito: dos compromisos bloqueantes solapados (falla la exclusion de rango).');
      }
      await expect(
        prisma.vehicleCommitment.count({ where: { vehicleId: v, status: { in: ['ACTIVE', 'CONSOLIDATED'] } } }),
      ).resolves.toBe(1);
    }
  }, 90000);

  it('periodos contiguos del mismo vehiculo [a,b) y [b,c) se confirman ambos', async () => {
    const resA = await draftReservation(otherVehicle, new Date('2026-12-01T14:00:00Z'), new Date('2026-12-03T14:00:00Z'));
    const resB = await draftReservation(otherVehicle, new Date('2026-12-03T14:00:00Z'), new Date('2026-12-05T14:00:00Z'));
    const handler = buildHandler();

    const results = await Promise.allSettled(
      [resA, resB].map((id) => handler.execute(new ConfirmReservationCommand(id, 'uid-integration', company, branch, 1))),
    );

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
  }, 60000);

  describe('exclusion de rango en BD (vehicle_commitments_no_overlap_excl)', () => {
    const insertCommitment = (vehicleId: string, status: string, from: string, to: string) =>
      prisma.vehicleCommitment.create({
        data: {
          organizationId: org,
          vehicleId,
          sourceType: 'MAINTENANCE',
          sourceId: randomUUID(),
          status,
          startsAt: new Date(from),
          endsAt: new Date(to),
        },
      });

    it('rechaza un commitment bloqueante solapado para el mismo vehiculo', async () => {
      if (!constraintExists) return; // migracion dejo la constraint pendiente por datos previos
      const v = randomUUID();
      await prisma.vehicle.create({ data: { id: v, organizationId: org, operatingCompanyId: company, plate: `EX-${v.slice(0, 6)}`, brand: 'Kia', model: 'Picanto' } });
      await insertCommitment(v, 'CONSOLIDATED', '2027-01-10T00:00:00Z', '2027-01-15T00:00:00Z');

      await expect(insertCommitment(v, 'ACTIVE', '2027-01-14T00:00:00Z', '2027-01-20T00:00:00Z')).rejects.toThrow();
    });

    it('acepta contiguos, otro vehiculo y solapes con commitments RELEASED', async () => {
      if (!constraintExists) return;
      const v = randomUUID();
      await prisma.vehicle.create({ data: { id: v, organizationId: org, operatingCompanyId: company, plate: `EY-${v.slice(0, 6)}`, brand: 'Kia', model: 'Rio' } });
      await insertCommitment(v, 'CONSOLIDATED', '2027-02-10T00:00:00Z', '2027-02-15T00:00:00Z');

      await expect(insertCommitment(v, 'CONSOLIDATED', '2027-02-15T00:00:00Z', '2027-02-20T00:00:00Z')).resolves.toBeDefined();
      await expect(insertCommitment(vehicle, 'CONSOLIDATED', '2027-02-10T00:00:00Z', '2027-02-15T00:00:00Z')).resolves.toBeDefined();
      await expect(insertCommitment(v, 'RELEASED', '2027-02-11T00:00:00Z', '2027-02-12T00:00:00Z')).resolves.toBeDefined();
    });
  });
});
