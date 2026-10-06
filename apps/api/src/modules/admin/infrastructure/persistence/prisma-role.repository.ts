import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { toWorkerRoleKey } from '../../../users/domain/worker-role';
import { RoleRecord, RoleRepositoryPort, RoleWithAssignmentCount } from '../../application/ports/role-repository.port';
import { RoleNameTakenError } from '../../domain/role-errors';

type Client = Prisma.TransactionClient | PrismaService;

type RoleRow = {
  id: string;
  organizationId: string;
  key: string | null;
  name: string;
  isSystem: boolean;
  active: boolean;
  version: number;
};

function toRecord(row: RoleRow): RoleRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    key: toWorkerRoleKey(row.key),
    name: row.name,
    isSystem: row.isSystem,
    active: row.active,
    version: row.version,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class PrismaRoleRepository implements RoleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByOrganization(
    organizationId: string,
    options: { includeInactive: boolean },
    tx?: Prisma.TransactionClient,
  ): Promise<RoleWithAssignmentCount[]> {
    const client: Client = tx ?? this.prisma;
    const [roles, counts] = await Promise.all([
      client.role.findMany({
        where: { organizationId, ...(options.includeInactive ? {} : { active: true }) },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      }),
      client.userCompanyAssignment.groupBy({
        by: ['roleId'],
        where: { organizationId, active: true },
        _count: { _all: true },
      }),
    ]);
    const countByRole = new Map(counts.map((row) => [row.roleId, row._count._all]));
    return roles.map((row) => ({ ...toRecord(row), assignmentCount: countByRole.get(row.id) ?? 0 }));
  }

  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient): Promise<RoleRecord | null> {
    const client: Client = tx ?? this.prisma;
    const row = await client.role.findFirst({ where: { id, organizationId } });
    return row ? toRecord(row) : null;
  }

  async listActive(organizationId: string, tx?: Prisma.TransactionClient): Promise<RoleRecord[]> {
    const client: Client = tx ?? this.prisma;
    const rows = await client.role.findMany({ where: { organizationId, active: true }, orderBy: { name: 'asc' } });
    return rows.map(toRecord);
  }

  async create(input: { organizationId: string; name: string }, tx?: Prisma.TransactionClient): Promise<RoleRecord> {
    const client: Client = tx ?? this.prisma;
    try {
      const row = await client.role.create({
        data: { organizationId: input.organizationId, name: input.name, key: null, isSystem: false },
      });
      return toRecord(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new RoleNameTakenError(input.name);
      throw error;
    }
  }

  async rename(
    input: { id: string; organizationId: string; expectedVersion: number; name: string },
    tx?: Prisma.TransactionClient,
  ): Promise<RoleRecord | null> {
    const client: Client = tx ?? this.prisma;
    try {
      const result = await client.role.updateMany({
        where: { id: input.id, organizationId: input.organizationId, version: input.expectedVersion },
        data: { name: input.name, version: { increment: 1 } },
      });
      if (result.count === 0) return null;
    } catch (error) {
      if (isUniqueViolation(error)) throw new RoleNameTakenError(input.name);
      throw error;
    }
    return this.findById(input.id, input.organizationId, tx);
  }

  async deactivate(
    input: { id: string; organizationId: string; expectedVersion: number },
    tx?: Prisma.TransactionClient,
  ): Promise<RoleRecord | null> {
    const client: Client = tx ?? this.prisma;
    const result = await client.role.updateMany({
      where: { id: input.id, organizationId: input.organizationId, version: input.expectedVersion },
      data: { active: false, version: { increment: 1 } },
    });
    if (result.count === 0) return null;
    return this.findById(input.id, input.organizationId, tx);
  }

  async countActiveAssignments(roleId: string, organizationId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const client: Client = tx ?? this.prisma;
    return client.userCompanyAssignment.count({ where: { roleId, organizationId, active: true } });
  }
}
