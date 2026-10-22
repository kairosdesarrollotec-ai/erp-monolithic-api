import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { isEnvFlagEnabled } from '../../../../common/config/env-flag';
import { missingDefaultMatrixEntries } from '../../domain/matrix-catalog-backfill';

export const MATRIX_CATALOG_SYNC_ACTOR = 'system:matrix-catalog-sync';

/**
 * P1 (frente B2, 21-oct-2026): al arrancar, concede los permisos NUEVOS del catalogo a los roles de sistema segun la regla de la
 * v0 en las organizaciones cuya matriz ya fue guardada (ver `missingDefaultMatrixEntries`). Inserta las filas faltantes DENTRO de
 * la version vigente de la capa de ORGANIZACION (las capas de empresa/sede caen a esa capa cuando no tienen entrada, ver
 * matrix-resolution), con `createMany skipDuplicates`: idempotente, seguro con varias replicas y sin cambiar el numero de version
 * (no invalida el ETag de nadie). Nunca pisa filas existentes. Un fallo solo se registra: no impide el arranque.
 * Se apaga con MATRIX_CATALOG_SYNC=off y no corre bajo Jest. Tambien cubre cualquier accion futura del catalogo.
 */
@Injectable()
export class MatrixCatalogSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MatrixCatalogSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    if (!isEnvFlagEnabled(process.env.MATRIX_CATALOG_SYNC) || process.env.JEST_WORKER_ID !== undefined) return;
    void this.syncAll().catch((error: Error) => {
      this.logger.error(`No se pudo sincronizar el catalogo de permisos: ${error.name}`);
    });
  }

  /** Recorre todas las organizaciones; devuelve cuantas filas se insertaron en total. */
  async syncAll(): Promise<{ organizations: number; inserted: number }> {
    const orgs = await this.prisma.role.findMany({ distinct: ['organizationId'], select: { organizationId: true } });
    let inserted = 0;
    for (const { organizationId } of orgs) {
      inserted += await this.syncOrganization(organizationId);
    }
    if (inserted > 0) this.logger.log(`Catalogo de permisos: ${inserted} filas nuevas sembradas en ${orgs.length} organizaciones.`);
    return { organizations: orgs.length, inserted };
  }

  async syncOrganization(organizationId: string, client: Prisma.TransactionClient | PrismaService = this.prisma): Promise<number> {
    const latest = await client.rolePermissionMatrixVersion.aggregate({
      where: { organizationId, companyId: null, branchId: null },
      _max: { version: true },
    });
    const version = latest._max.version;
    // Sin matriz guardada: rige la version 0 implicita, que ya trae el catalogo completo.
    if (version === null || version === undefined) return 0;

    const existing = await client.rolePermissionMatrixVersion.findMany({
      where: { organizationId, version, companyId: null, branchId: null },
      select: { roleId: true, action: true },
    });
    const systemRoles = await client.role.findMany({
      where: { organizationId, isSystem: true, key: { not: null } },
      select: { id: true, key: true },
    });
    const roleIdByKey = new Map(systemRoles.map((role) => [role.key as string, role.id]));
    const missing = missingDefaultMatrixEntries(existing, roleIdByKey);
    if (missing.length === 0) return 0;

    const result = await client.rolePermissionMatrixVersion.createMany({
      data: missing.map((entry) => ({
        organizationId,
        version,
        roleId: entry.roleId,
        companyId: null,
        branchId: null,
        action: `${entry.module}.${entry.action}`,
        allowed: entry.allowed,
        createdBy: MATRIX_CATALOG_SYNC_ACTOR,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }
}
