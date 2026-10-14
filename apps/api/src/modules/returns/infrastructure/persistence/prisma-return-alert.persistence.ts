import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  ListAlertCandidatesFilter,
  ReturnAlertRepositoryPort,
} from '../../application/ports/return-alert-repository.port';
import type { ReturnRecord } from '../../application/ports/return-repository.port';
import { RETURN_INCLUDE, toReturnRecord } from './return-persistence.mapper';

@Injectable()
export class PrismaReturnAlertPersistence implements ReturnAlertRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listCandidates(filter: ListAlertCandidatesFilter): Promise<ReturnRecord[]> {
    const rows = await this.prisma.rentalReturn.findMany({
      where: {
        organizationId: filter.organizationId,
        operatingCompanyId: filter.operatingCompanyId,
        branchId: filter.branchId,
        receivedAt: { not: null, lte: filter.receivedBefore },
        OR: [
          { status: 'SIN_DANOS' },
          { status: { in: ['CON_DANOS', 'CIERRE_FINANCIERO'] }, damages: { some: { origin: 'TECHNICAL' } } },
        ],
      },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      take: filter.limit,
      include: RETURN_INCLUDE,
    });
    return rows.map(toReturnRecord);
  }
}
