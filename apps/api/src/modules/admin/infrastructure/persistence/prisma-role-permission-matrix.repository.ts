import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  MatrixScope,
  ORGANIZATION_SCOPE,
  RolePermissionEntry,
  RolePermissionMatrixPort,
  RolePermissionMatrixSnapshot,
} from '../../application/ports/role-permission-matrix.port';
import { buildDefaultRolePermissionMatrix } from '../../domain/default-role-permission-matrix';
import { layersForContext } from '../../domain/matrix-resolution';
import { MatrixVersionConflictError } from '../../domain/role-errors';
import type { PermissionModule } from '../../domain/permission-action-catalog';

type Client = Prisma.TransactionClient | PrismaService;

/**
 * Matriz ADM-02 con roles dinamicos y ambito (ver RolePermissionMatrixPort).
 *
 * Cada fila de `role_permission_matrix_versions` lleva el ambito de su
 * version (`company_id`/`branch_id`, NULL = organizacion). "Vigente" por
 * ambito = la fila de mayor `version` para ese (organizacion, empresa, sede).
 * La numeracion es unica por organizacion, compartida entre ambitos.
 */
@Injectable()
export class PrismaRolePermissionMatrixRepository implements RolePermissionMatrixPort {
  constructor(private readonly prisma: PrismaService) {}

  async getLayers(
    organizationId: string,
    scope?: { companyId: string; branchId: string | null },
    options?: { roleId?: string },
    tx?: Prisma.TransactionClient,
  ): Promise<RolePermissionMatrixSnapshot[]> {
    const client: Client = tx ?? this.prisma;
    const scopes: MatrixScope[] = [ORGANIZATION_SCOPE];
    if (scope) {
      scopes.push({ companyId: scope.companyId, branchId: null });
      if (scope.branchId) scopes.push({ companyId: scope.companyId, branchId: scope.branchId });
    }
    const snapshots = await this.loadLatestSnapshots(client, organizationId, scopes, options?.roleId);
    return layersForContext(snapshots, scope ?? null);
  }

  async getCurrentVersion(
    organizationId: string,
    scope: MatrixScope = ORGANIZATION_SCOPE,
    tx?: Prisma.TransactionClient,
  ): Promise<RolePermissionMatrixSnapshot> {
    const layers = await this.getLayers(
      organizationId,
      scope.companyId ? { companyId: scope.companyId, branchId: scope.branchId } : undefined,
      undefined,
      tx,
    );
    // La capa de organizacion siempre existe (version 0 implicita si no hay ninguna guardada).
    return layers[0];
  }

  async getAllCurrentSnapshots(organizationId: string, tx?: Prisma.TransactionClient): Promise<RolePermissionMatrixSnapshot[]> {
    const client: Client = tx ?? this.prisma;
    return this.loadLatestSnapshots(client, organizationId, null);
  }

  async saveNewVersion(
    organizationId: string,
    entries: RolePermissionEntry[],
    createdBy: string,
    scope: MatrixScope,
    tx?: Prisma.TransactionClient,
  ): Promise<RolePermissionMatrixSnapshot> {
    const client: Client = tx ?? this.prisma;
    const latest = await client.rolePermissionMatrixVersion.aggregate({
      where: { organizationId },
      _max: { version: true },
    });
    const nextVersion = (latest._max.version ?? 0) + 1;

    try {
      await client.rolePermissionMatrixVersion.createMany({
        data: entries.map((entry) => ({
          organizationId,
          version: nextVersion,
          roleId: entry.roleId,
          companyId: scope.companyId,
          branchId: scope.branchId,
          action: `${entry.module}.${entry.action}`,
          allowed: entry.allowed,
          createdBy,
        })),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new MatrixVersionConflictError();
      }
      throw error;
    }

    return { version: nextVersion, scope, entries };
  }

  /**
   * Ultima version de cada ambito pedido (`scopes`) o de TODOS los ambitos con
   * version propia (`scopes = null`). Si la organizacion no tiene version
   * propia a nivel organizacion, agrega la version 0 implicita derivada de las
   * policies estaticas.
   */
  private async loadLatestSnapshots(
    client: Client,
    organizationId: string,
    scopes: MatrixScope[] | null,
    roleId?: string,
  ): Promise<RolePermissionMatrixSnapshot[]> {
    const scopeFilter: Prisma.RolePermissionMatrixVersionWhereInput = scopes
      ? { OR: scopes.map((s) => ({ companyId: s.companyId, branchId: s.branchId })) }
      : {};
    const latest = await client.rolePermissionMatrixVersion.groupBy({
      by: ['companyId', 'branchId'],
      where: { organizationId, ...scopeFilter },
      _max: { version: true },
    });

    const snapshots: RolePermissionMatrixSnapshot[] = [];
    if (latest.length > 0) {
      const rows = await client.rolePermissionMatrixVersion.findMany({
        where: {
          organizationId,
          ...(roleId ? { roleId } : {}),
          OR: latest.map((group) => ({
            version: group._max.version as number,
            companyId: group.companyId,
            branchId: group.branchId,
          })),
        },
      });
      for (const group of latest) {
        const version = group._max.version as number;
        snapshots.push({
          version,
          scope: { companyId: group.companyId, branchId: group.branchId },
          entries: rows
            .filter((row) => row.version === version && row.companyId === group.companyId && row.branchId === group.branchId)
            .map((row) => ({
              roleId: row.roleId,
              module: row.action.split('.')[0] as PermissionModule,
              action: row.action.split('.')[1],
              allowed: row.allowed,
            })),
        });
      }
    }

    const hasOrganizationLayer = snapshots.some((s) => s.scope.companyId === null && s.scope.branchId === null);
    if (!hasOrganizationLayer) {
      snapshots.push({ version: 0, scope: ORGANIZATION_SCOPE, entries: await this.buildImplicitVersion(client, organizationId, roleId) });
    }
    return snapshots;
  }

  /** Version 0: las policies estaticas mapeadas key -> role_id de ESTA organizacion. */
  private async buildImplicitVersion(client: Client, organizationId: string, roleId?: string): Promise<RolePermissionEntry[]> {
    const systemRoles = await client.role.findMany({
      where: { organizationId, key: { not: null }, ...(roleId ? { id: roleId } : {}) },
      select: { id: true, key: true },
    });
    const roleIdByKey = new Map(systemRoles.map((role) => [role.key as string, role.id]));
    return buildDefaultRolePermissionMatrix(roleIdByKey);
  }
}
