import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { HrAreaRepositoryPort, type HrAreaView } from '../../application/ports/hr-area-repository.port';

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
}
