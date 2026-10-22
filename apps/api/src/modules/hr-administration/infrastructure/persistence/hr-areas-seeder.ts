import type { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_HR_AREAS } from '../../domain/hr-area-rules';

/**
 * Siembra (idempotente) el catalogo de areas de RR.HH. de UNA empresa (Respuestas 2026-10-20 #17): las 7 del organigrama +
 * Gerencia General/Subgerencia + Gestion y Procesos. Es el hook de "alta de empresa": todo punto que crea una `Company`
 * (hoy scripts/seed-platform-admin.ts y los tests de integracion) lo llama justo despues. Nunca pisa un area existente
 * (si Gerencia renombro o desactivo una, se conserva).
 */
export async function ensureHrAreasForCompany(
  client: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  operatingCompanyId: string,
): Promise<number> {
  const result = await client.hrArea.createMany({
    data: DEFAULT_HR_AREAS.map((a) => ({
      organizationId,
      operatingCompanyId,
      code: a.code,
      name: a.name,
      description: a.description,
      sortOrder: a.sortOrder,
    })),
    skipDuplicates: true,
  });
  return result.count;
}
