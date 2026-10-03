import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/persistence/prisma.service';
import { PrismaTransactionManager } from '../../src/common/persistence/prisma-transaction-manager';
import { PrismaRentalRepository } from '../../src/modules/rentals/infrastructure/persistence/prisma-rental.repository';
import { PrismaContractTemplatePersistence } from '../../src/modules/rentals/infrastructure/persistence/prisma-contract-template.persistence';
import { PrismaRentalExtensionPersistence } from '../../src/modules/rentals/infrastructure/persistence/prisma-rental-extension.persistence';
import { PrismaRentalNotaryContractPersistence } from '../../src/modules/rentals/infrastructure/persistence/prisma-rental-notary-contract.persistence';
import { PrismaOutboxEventRepository } from '../../src/modules/outbox/infrastructure/persistence/prisma-outbox-event.repository';
import { WorkContextAuthorizationService } from '../../src/modules/users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../src/modules/authorization/matrix-authorization.service';
import { PrismaRolePermissionMatrixRepository } from '../../src/modules/admin/infrastructure/persistence/prisma-role-permission-matrix.repository';
import { CreateRentalHandler } from '../../src/modules/rentals/application/commands/create-rental.handler';
import { CreateRentalCommand } from '../../src/modules/rentals/application/commands/create-rental.command';
import { GetRentalHandler } from '../../src/modules/rentals/application/queries/get-rental.handler';
import { GetRentalQuery } from '../../src/modules/rentals/application/queries/get-rental.query';
import { ListRentalsHandler } from '../../src/modules/rentals/application/queries/list-rentals.handler';
import { ListRentalsQuery } from '../../src/modules/rentals/application/queries/list-rentals.query';
import { NotFoundException } from '@nestjs/common';
import { getTestDatabase, TestDatabase } from '../helpers/test-database';

/**
 * Prueba de aislamiento multiempresa para el modulo de alquileres.
 * SECURITY_RISK: un alquiler de Empresa A no debe ser visible desde el contexto de Empresa B.
 * Cubre el requisito de aislamiento de datos por operatingCompanyId + branchId.
 */
describe('Rentals — aislamiento multiempresa (Postgres real)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;

  const org = randomUUID();
  const companyA = randomUUID();
  const branchA = randomUUID();
  const companyB = randomUUID();
  const branchB = randomUUID();
  const customerA = randomUUID();
  const vehicleA = randomUUID();
  const customerB = randomUUID();
  const vehicleB = randomUUID();

  const UID_A = 'uid-it-tenant-a';
  const UID_B = 'uid-it-tenant-b';

  function buildPrismaService(): PrismaService {
    return prisma as unknown as PrismaService;
  }

  function buildRentalRepository(): PrismaRentalRepository {
    const ps = buildPrismaService();
    return new PrismaRentalRepository(
      ps,
      new PrismaContractTemplatePersistence(ps),
      new PrismaRentalExtensionPersistence(ps),
      new PrismaRentalNotaryContractPersistence(ps),
    );
  }

  function buildWorkContext(companyId: string, branchId: string) {
    return {
      authorize: async () => ({ organizationId: org, companyId, branchId, role: 'FRONT_OFFICE' as const }),
    } as unknown as WorkContextAuthorizationService;
  }

  function buildMatrixAuth() {
    const matrixRepo = new PrismaRolePermissionMatrixRepository(buildPrismaService());
    return new MatrixAuthorizationService(matrixRepo);
  }

  function buildAudit() {
    return {
      recordLoginAttempt: async () => undefined,
      recordWorkContextSelection: async () => undefined,
      recordReservationEvent: async () => undefined,
      recordInquiryEvent: async () => undefined,
      recordAdminEvent: async () => undefined,
      recordRentalEvent: async () => undefined,
    } as any;
  }

  beforeAll(async () => {
    db = await getTestDatabase();
    prisma = db.prisma;

    await prisma.company.createMany({
      data: [
        { id: companyA, organizationId: org, name: 'Empresa A Isolation' },
        { id: companyB, organizationId: org, name: 'Empresa B Isolation' },
      ],
    });
    await prisma.branch.createMany({
      data: [
        { id: branchA, companyId: companyA, name: 'Sede A Isolation' },
        { id: branchB, companyId: companyB, name: 'Sede B Isolation' },
      ],
    });
    await prisma.customer.createMany({
      data: [
        {
          id: customerA,
          organizationId: org,
          operatingCompanyId: companyA,
          fullName: 'Cliente Empresa A',
          documentType: 'DNI',
          documentNumber: `A${randomUUID().slice(0, 7)}`,
        },
        {
          id: customerB,
          organizationId: org,
          operatingCompanyId: companyB,
          fullName: 'Cliente Empresa B',
          documentType: 'DNI',
          documentNumber: `B${randomUUID().slice(0, 7)}`,
        },
      ],
    });
    await prisma.vehicle.createMany({
      data: [
        {
          id: vehicleA,
          organizationId: org,
          operatingCompanyId: companyA,
          plate: `A-${vehicleA.slice(0, 6)}`,
          brand: 'Honda',
          model: 'Fit',
        },
        {
          id: vehicleB,
          organizationId: org,
          operatingCompanyId: companyB,
          plate: `B-${vehicleB.slice(0, 6)}`,
          brand: 'Mazda',
          model: 'CX-3',
        },
      ],
    });
  }, 60000);

  afterAll(async () => {
    if (db) await db.stop();
  });

  it('alquiler de Empresa A NO es visible desde el contexto de Empresa B (GetRental retorna 404)', async () => {
    const ps = buildPrismaService();
    const rentalRepo = buildRentalRepository();
    const outbox = new PrismaOutboxEventRepository(ps);
    const txManager = new PrismaTransactionManager(ps);
    const matrixAuth = buildMatrixAuth();
    const audit = buildAudit();
    const workContextA = buildWorkContext(companyA, branchA);

    // Crear alquiler en Empresa A
    const createHandler = new CreateRentalHandler(rentalRepo, workContextA, matrixAuth, txManager, audit, outbox);
    const rentalA = await createHandler.execute(
      new CreateRentalCommand(
        UID_A,
        companyA,
        branchA,
        customerA,
        vehicleA,
        'NORMAL',
        new Date('2026-10-20T09:00:00Z'),
        new Date('2026-10-25T09:00:00Z'),
      ),
    );
    expect(rentalA.status).toBe('DRAFT');
    expect(rentalA.operatingCompanyId).toBe(companyA);

    // Intentar leer desde el contexto de Empresa B → debe lanzar NotFoundException
    const workContextB = buildWorkContext(companyB, branchB);
    const getHandler = new GetRentalHandler(rentalRepo, workContextB, matrixAuth);

    await expect(
      getHandler.execute(new GetRentalQuery(rentalA.id, UID_B, companyB, branchB)),
    ).rejects.toThrow(NotFoundException);
  }, 60000);

  it('listRentals en Empresa B no retorna alquileres de Empresa A', async () => {
    const ps = buildPrismaService();
    const rentalRepo = buildRentalRepository();
    const outbox = new PrismaOutboxEventRepository(ps);
    const txManager = new PrismaTransactionManager(ps);
    const matrixAuth = buildMatrixAuth();
    const audit = buildAudit();
    const workContextA = buildWorkContext(companyA, branchA);

    // Crear un alquiler en Empresa A
    const createHandler = new CreateRentalHandler(rentalRepo, workContextA, matrixAuth, txManager, audit, outbox);
    await createHandler.execute(
      new CreateRentalCommand(
        UID_A,
        companyA,
        branchA,
        customerA,
        vehicleA,
        'NORMAL',
        new Date('2026-11-10T09:00:00Z'),
        new Date('2026-11-15T09:00:00Z'),
      ),
    );

    // Listar alquileres desde el contexto de Empresa B → no debe aparecer ninguno de A
    const workContextB = buildWorkContext(companyB, branchB);
    const listHandler = new ListRentalsHandler(rentalRepo, workContextB, matrixAuth);
    const resultB = await listHandler.execute(new ListRentalsQuery(UID_B, companyB, branchB));

    const rentalIdsB = resultB.map((r) => r.operatingCompanyId);
    expect(rentalIdsB.every((cid) => cid === companyB)).toBe(true);
  }, 60000);

  it('aislamiento de repositorio directo: findById con scope de Empresa B no retorna alquiler de Empresa A', async () => {
    const ps = buildPrismaService();
    const rentalRepo = buildRentalRepository();
    const outbox = new PrismaOutboxEventRepository(ps);
    const txManager = new PrismaTransactionManager(ps);
    const matrixAuth = buildMatrixAuth();
    const audit = buildAudit();
    const workContextA = buildWorkContext(companyA, branchA);

    // Crear alquiler en Empresa A
    const createHandler = new CreateRentalHandler(rentalRepo, workContextA, matrixAuth, txManager, audit, outbox);
    const rentalA = await createHandler.execute(
      new CreateRentalCommand(
        UID_A,
        companyA,
        branchA,
        customerA,
        vehicleA,
        'NORMAL',
        new Date('2026-12-01T09:00:00Z'),
        new Date('2026-12-05T09:00:00Z'),
      ),
    );

    // Consultar directo al repo con scope de Empresa B
    const result = await rentalRepo.findById(rentalA.id, {
      organizationId: org,
      operatingCompanyId: companyB,
      branchId: branchB,
    });

    expect(result).toBeNull();
  }, 60000);
});
