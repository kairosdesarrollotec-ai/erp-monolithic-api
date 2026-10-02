import { randomUUID } from 'crypto';
import { PrismaService } from '../../src/common/persistence/prisma.service';
import { PrismaTransactionManager } from '../../src/common/persistence/prisma-transaction-manager';
import { ClockPort } from '../../src/common/application/ports/clock.port';
import { PrismaInquiryRepository } from '../../src/modules/inquiries/infrastructure/persistence/prisma-inquiry.repository';
import { PrismaReservationRepository } from '../../src/modules/reservations/infrastructure/persistence/prisma-reservation.repository';
import { ConvertToReservationHandler } from '../../src/modules/inquiries/application/commands/convert-to-reservation.handler';
import { ConvertToReservationCommand } from '../../src/modules/inquiries/application/commands/convert-to-reservation.command';
import { PrismaOutboxEventRepository } from '../../src/modules/outbox/infrastructure/persistence/prisma-outbox-event.repository';
import { ProvisionalQuotingGuard } from '../../src/modules/inquiries/application/services/provisional-quoting.guard';
import { WorkContextAuthorizationService } from '../../src/modules/users/application/services/work-context-authorization.service';
import { PrismaReservationDepositPolicyRepository } from '../../src/modules/parameters/infrastructure/persistence/prisma-reservation-deposit-policy.repository';
import { MatrixAuthorizationService } from '../../src/modules/authorization/matrix-authorization.service';
import { PrismaRolePermissionMatrixRepository } from '../../src/modules/admin/infrastructure/persistence/prisma-role-permission-matrix.repository';
import { getTestDatabase, TestDatabase } from '../helpers/test-database';
import { PrismaClient } from '@prisma/client';

/**
 * Integracion sobre PostgreSQL REAL + cliente Prisma real (revalidacion PR#7):
 * - CRITICO "cardinalidad": dos conversiones CONCURRENTES de la misma
 *   consulta -> exactamente UNA reserva; la perdedora recibe un error de
 *   negocio (412/409/422), nunca una segunda reserva ni un 500.
 * - ALTO "aislamiento": una consulta de otra sede no es visible desde el
 *   scope de la sede propia; la base rechaza cotizar un vehiculo de otra
 *   empresa (FK compuesta).
 *
 * Utiliza Testcontainers para un PostgreSQL efímero y limpio o el provisto por CI.
 */
describe('Consulta -> Reserva (Postgres real)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  const org = randomUUID();
  const company = randomUUID();
  const otherCompany = randomUUID();
  const branch = randomUUID();
  const otherBranch = randomUUID();
  const customer = randomUUID();
  const vehicle = randomUUID();
  const foreignVehicle = randomUUID();

  class FixedClock extends ClockPort {
    now() {
      return new Date('2026-09-23T15:00:00Z');
    }
  }

  function buildHandler() {
    const workContext = {
      authorize: async () => ({ organizationId: org, companyId: company, branchId: branch, role: 'FRONT_OFFICE' as const }),
    } as unknown as WorkContextAuthorizationService;
    const guard = new ProvisionalQuotingGuard(
      { productionReady: false } as any,
      { production: false, allowProvisional: false },
    );
    const audit = { recordInquiryEvent: async () => undefined } as any;
    const matrixRepo = new PrismaRolePermissionMatrixRepository(prisma as unknown as PrismaService);
    const matrixAuth = new MatrixAuthorizationService(matrixRepo);
    return new ConvertToReservationHandler(
      new PrismaInquiryRepository(prisma as unknown as PrismaService),
      new PrismaReservationRepository(prisma as unknown as PrismaService),
      workContext,
      audit,
      new PrismaOutboxEventRepository(prisma as unknown as PrismaService),
      new PrismaTransactionManager(prisma as unknown as PrismaService),
      guard,
      new FixedClock(),
      new PrismaReservationDepositPolicyRepository(prisma as unknown as PrismaService),
      matrixAuth,
    );
  }

  async function quotedInquiry(): Promise<string> {
    const inquiry = await prisma.inquiry.create({
      data: {
        organizationId: org,
        operatingCompanyId: company,
        branchId: branch,
        customerId: customer,
        channel: 'WHATSAPP',
        touristUse: true,
        destination: 'Vilcashuaman',
        estimatedDays: 2,
        status: 'COTIZADA',
        version: 2,
        createdBy: 'uid-integration',
      },
    });
    await prisma.quotation.create({
      data: {
        inquiryId: inquiry.id,
        operatingCompanyId: company,
        vehicleId: vehicle,
        rateCardVersionId: 'RC-IT',
        destination: 'Vilcashuaman',
        estimatedDays: 2,
        amount: '240.00',
        currency: 'PEN',
        validUntil: new Date('2026-09-26T00:00:00Z'),
      },
    });
    return inquiry.id;
  }

  beforeAll(async () => {
    db = await getTestDatabase();
    prisma = db.prisma;

    await prisma.company.createMany({
      data: [
        { id: company, organizationId: org, name: 'Empresa IT' },
        { id: otherCompany, organizationId: org, name: 'Otra empresa IT' },
      ],
    });
    await prisma.branch.createMany({
      data: [
        { id: branch, companyId: company, name: 'Sede IT' },
        { id: otherBranch, companyId: company, name: 'Otra sede IT' },
      ],
    });
    await prisma.customer.create({
      data: { id: customer, organizationId: org, operatingCompanyId: company, fullName: 'Cliente IT', documentType: 'DNI', documentNumber: '1' },
    });
    await prisma.vehicle.createMany({
      data: [
        { id: vehicle, organizationId: org, operatingCompanyId: company, plate: `IT-${vehicle.slice(0, 6)}`, brand: 'Toyota', model: 'Hilux' },
        { id: foreignVehicle, organizationId: org, operatingCompanyId: otherCompany, plate: `IT-${foreignVehicle.slice(0, 6)}`, brand: 'Kia', model: 'Rio' },
      ],
    });
  }, 60000);

  afterAll(async () => {
    if (db) {
      await db.stop();
    }
  });

  it('dos conversiones concurrentes de la misma consulta crean exactamente UNA reserva', async () => {
    const inquiryId = await quotedInquiry();
    const handler = buildHandler();
    const convert = () =>
      handler.execute(
        new ConvertToReservationCommand(inquiryId, 'uid-integration', company, branch, 2, 'PRESENCIAL', new Date('2026-10-01T14:00:00Z')),
      );

    const results = await Promise.allSettled([convert(), convert()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect([409, 412, 422]).toContain(rejected[0].reason.getStatus?.());
    await expect(prisma.reservation.count({ where: { inquiryId } })).resolves.toBe(1);
    await expect(prisma.inquiry.findUniqueOrThrow({ where: { id: inquiryId } })).resolves.toEqual(
      expect.objectContaining({ status: 'CONVERTIDA', version: 3 }),
    );
  });

  it('una consulta de OTRA sede de la misma empresa no es visible desde el scope propio (cross-branch)', async () => {
    // Fixture de aislamiento: se inserta como LEGACY_STUB para no requerir
    // customerId (el CHECK lo exime); el contenido no importa, solo la sede.
    const other = await prisma.inquiry.create({
      data: {
        organizationId: org,
        operatingCompanyId: company,
        branchId: otherBranch,
        dataOrigin: 'LEGACY_STUB',
        touristUse: false,
        createdBy: 'uid-integration',
      },
    });

    const repo = new PrismaInquiryRepository(prisma as unknown as PrismaService);
    await expect(repo.findById(other.id, { organizationId: org, operatingCompanyId: company, branchId: branch })).resolves.toBeNull();
    await expect(repo.findById(other.id, { organizationId: org, operatingCompanyId: company, branchId: otherBranch })).resolves.not.toBeNull();
  });

  it('la base rechaza cotizar un vehiculo de OTRA empresa de la misma organizacion (cross-company)', async () => {
    const inquiryId = await quotedInquiry();

    await expect(
      prisma.quotation.create({
        data: {
          inquiryId,
          operatingCompanyId: company,
          vehicleId: foreignVehicle,
          rateCardVersionId: 'RC-IT',
          destination: 'X',
          estimatedDays: 1,
          amount: '120.00',
          currency: 'PEN',
          validUntil: new Date('2026-09-26T00:00:00Z'),
        },
      }),
    ).rejects.toThrow();
  });

  it('la base rechaza una consulta CON02 sin snapshot obligatorio (CHECK inquiries_con02_snapshot_check)', async () => {
    await expect(
      prisma.inquiry.create({
        data: {
          organizationId: org,
          operatingCompanyId: company,
          branchId: branch,
          channel: 'WHATSAPP',
          touristUse: true,
          createdBy: 'uid-integration',
        },
      }),
    ).rejects.toThrow();
  });
});
