import type { Prisma, PrismaClient } from '@prisma/client';
import { SYSTEM_ROLE_DEFINITIONS } from '../../domain/system-roles';

/**
 * Siembra (idempotente) los 8 roles de sistema de una organizacion. Es el
 * "flujo de creacion de organizacion" para roles dinamicos: una organizacion
 * no es una tabla (es el `organization_id` compartido), asi que cada punto que
 * la da de alta (hoy: scripts/seed-platform-admin.ts y los tests de
 * integracion) llama a esto ANTES de crear asignaciones.
 *
 * Devuelve key -> role_id (existentes o recien creados). Nunca pisa un rol ya
 * existente (si el administrador renombro un rol de sistema, se conserva su nombre).
 */
export async function ensureSystemRoles(
  client: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
): Promise<Map<string, string>> {
  await client.role.createMany({
    data: SYSTEM_ROLE_DEFINITIONS.map((definition) => ({
      organizationId,
      key: definition.key,
      name: definition.name,
      isSystem: true,
    })),
    skipDuplicates: true,
  });
  const rows = await client.role.findMany({
    where: { organizationId, isSystem: true, key: { not: null } },
    select: { id: true, key: true },
  });
  return new Map(rows.map((row) => [row.key as string, row.id]));
}
