import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Test de integridad a nivel de base de datos REAL (Postgres), no un
 * mock - hallazgo CRITICO de revision de seguimiento de PR#4
 * (revalidacion de 9e33c4f: "organizationId aun puede contradecir a
 * companyId") pide explicitamente "tests negativos de integridad" para
 * la FK compuesta company_id+organization_id agregada en la migracion
 * 20260922000000_fix_company_organization_integrity.
 *
 * No corre junto a los tests unitarios (`npm run test`) ni en el CI
 * actual (.github/workflows/ci.yml) - necesita un Postgres real
 * levantado (docker-compose.yml de la raiz del repo) y el cliente
 * Prisma generado contra el schema actualizado, cosa que este sandbox
 * de desarrollo no puede hacer (sin red hacia binaries.prisma.sh, ver
 * nota en prisma/migrations/20260918000000_init/migration.sql). Correr
 * a mano (o agregar como job de CI aparte con Postgres de servicio):
 *
 *   docker compose up -d
 *   npm run prisma:generate --workspace=apps/api
 *   npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
 *   npm run test:integration --workspace=apps/api
 *
 * Esta es la evidencia automatizada que la revision de PR#4 senala como
 * pendiente ("Verificacion requerida"); documentado tambien en
 * docs/migraciones-baseline.md.
 */
describe('Integridad company/organization (Postgres real)', () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
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
