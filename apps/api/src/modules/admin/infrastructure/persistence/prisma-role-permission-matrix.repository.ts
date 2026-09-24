import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  RolePermissionEntry,
  RolePermissionMatrixPort,
  RolePermissionMatrixSnapshot,
} from '../../application/ports/role-permission-matrix.port';
import { buildDefaultRolePermissionMatrix } from '../../domain/default-role-permission-matrix';

@Injectable()
export class PrismaRolePermissionMatrixRepository implements RolePermissionMatrixPort {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentVersion(organizationId: string): Promise<RolePermissionMatrixSnapshot> {
    const latestRow = await this.prisma.rolePermissionMatrixVersion.findFirst({
      where: { organizationId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    if (!latestRow) {
      return { version: 0, entries: buildDefaultRolePermissionMatrix() };
    }

    const rows = await this.prisma.rolePermissionMatrixVersion.findMany({
      where: { organizationId, version: latestRow.version },
    });

    return {
      version: latestRow.version,
      entries: rows.map((row) => ({
        role: row.role,
        module: row.action.split('.')[0] as RolePermissionEntry['module'],
        action: row.action.split('.')[1],
        allowed: row.allowed,
      })),
    };
  }

  async saveNewVersion(
    organizationId: string,
    entries: RolePermissionEntry[],
    createdBy: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RolePermissionMatrixSnapshot> {
    const client = tx ?? this.prisma;
    const latestRow = await client.rolePermissionMatrixVersion.findFirst({
      where: { organizationId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latestRow?.version ?? 0) + 1;

    await client.rolePermissionMatrixVersion.createMany({
      data: entries.map((entry) => ({
        organizationId,
        version: nextVersion,
        role: entry.role,
        action: `${entry.module}.${entry.action}`,
        allowed: entry.allowed,
        createdBy,
      })),
    });

    return { version: nextVersion, entries };
  }
}
