import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  type CreateHrAreaData,
  HrAreaRepositoryPort,
  type HrAreaAdminView,
  type HrAreaView,
} from '../../application/ports/hr-area-repository.port';

const SELECT = { code: true, name: true, description: true, sortOrder: true, isActive: true } as const;

@Injectable()
export class PrismaHrAreaRepository extends HrAreaRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listActive(operatingCompanyId: string, tx?: Prisma.TransactionClient): Promise<HrAreaView[]> {
    const client = tx ?? this.prisma;
    const rows = await client.hrArea.findMany({
      where: { operatingCompanyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { code: true, name: true, description: true, sortOrder: true },
    });
    return rows;
  }

  async listAll(operatingCompanyId: string, tx?: Prisma.TransactionClient): Promise<HrAreaAdminView[]> {
    const client = tx ?? this.prisma;
    return client.hrArea.findMany({
      where: { operatingCompanyId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: SELECT,
    });
  }

  async findByCode(operatingCompanyId: string, code: string, tx?: Prisma.TransactionClient): Promise<HrAreaAdminView | null> {
    const client = tx ?? this.prisma;
    return client.hrArea.findUnique({
      where: { operatingCompanyId_code: { operatingCompanyId, code } },
      select: SELECT,
    });
  }

  async create(data: CreateHrAreaData, tx?: Prisma.TransactionClient): Promise<HrAreaAdminView> {
    const client = tx ?? this.prisma;
    return client.hrArea.create({
      data: {
        organizationId: data.organizationId,
        operatingCompanyId: data.operatingCompanyId,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        sortOrder: data.sortOrder,
      },
      select: SELECT,
    });
  }

  async setActive(operatingCompanyId: string, code: string, isActive: boolean, tx?: Prisma.TransactionClient): Promise<HrAreaAdminView> {
    const client = tx ?? this.prisma;
    return client.hrArea.update({
      where: { operatingCompanyId_code: { operatingCompanyId, code } },
      data: { isActive },
      select: SELECT,
    });
  }

  async countActiveEmployees(operatingCompanyId: string, code: string, tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx ?? this.prisma;
    return client.employee.count({ where: { operatingCompanyId, areaId: code, status: { not: 'TERMINADO' } } });
  }

  async maxSortOrder(operatingCompanyId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx ?? this.prisma;
    const agg = await client.hrArea.aggregate({ where: { operatingCompanyId }, _max: { sortOrder: true } });
    return agg._max.sortOrder ?? 0;
  }
}
