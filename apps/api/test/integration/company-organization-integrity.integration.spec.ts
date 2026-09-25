import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getTestDatabase, TestDatabase } from '../helpers/test-database';

/**
 * Test de integridad a nivel de base de datos REAL (Postgres), no un
 * mock - hallazgo CRITICO de revision de seguimiento de PR#4
 * (revalidacion de 9e33c4f: "organizationId aun puede contradecir a
 * companyId") pide explicitamente "tests negativos de integridad" para
 * la FK compuesta company_id+organization_id agregada en la migracion
 * 20260922000000_fix_company_organization_integrity.
 *
 * Utiliza Testcontainers para garantizar un PostgreSQL efímero y limpio,
 * o el PostgreSQL de servicio provisto en CI.
 */
describe('Integridad company/organization (Postgres real)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;

  beforeAll(async () => {
    db = await getTestDatabase();
    prisma = db.prisma;
  }, 60000);

  afterAll(async () => {
    if (db) {
      await db.stop();
    }
  });

  it('la base RECHAZA una asignacion cuyo organizationId no coincide con el de la company referenciada', async () => {
    const orgA = randomUUID();
    const orgB = randomUUID(); // organizacion distinta, deliberadamente
    const companyId = randomUUID();
    const branchId = randomUUID();
    const firebaseUid = `test-integrity-${randomUUID()}`;

    await prisma.company.create({
      data: { id: companyId, organizationId: orgA, name: 'Empresa Org A (test integridad)' },
    });
    await prisma.branch.create({
      data: { id: branchId, companyId, name: 'Sede (test integridad)' },
    });

    try {
      await expect(
        prisma.userCompanyAssignment.create({
          data: {
            organizationId: orgB, // <- contradice al organizationId real de companyId (orgA)
            firebaseUid,
            companyId,
            branchId,
            role: 'ADMINISTRACION',
          },
        }),
      ).rejects.toThrow();
    } finally {
      await prisma.branch.delete({ where: { id: branchId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
  });

  it('la base ACEPTA la misma asignacion cuando organizationId SI coincide con el de la company (caso feliz de control)', async () => {
    const orgA = randomUUID();
    const companyId = randomUUID();
    const branchId = randomUUID();
    const firebaseUid = `test-integrity-${randomUUID()}`;

    await prisma.company.create({
      data: { id: companyId, organizationId: orgA, name: 'Empresa Org A (test integridad OK)' },
    });
    await prisma.branch.create({
      data: { id: branchId, companyId, name: 'Sede (test integridad OK)' },
    });

    const assignment = await prisma.userCompanyAssignment.create({
      data: {
        organizationId: orgA, // <- coincide con el organizationId real de companyId
        firebaseUid,
        companyId,
        branchId,
        role: 'ADMINISTRACION',
      },
    });

    expect(assignment.organizationId).toBe(orgA);

    await prisma.userCompanyAssignment.delete({ where: { id: assignment.id } });
    await prisma.branch.delete({ where: { id: branchId } });
    await prisma.company.delete({ where: { id: companyId } });
  });
});
