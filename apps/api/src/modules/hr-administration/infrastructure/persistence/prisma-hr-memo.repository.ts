import { Injectable } from '@nestjs/common';
import type { HrMemo, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { CreateHrMemoData, HrMemoRepositoryPort } from '../../application/ports/hr-memo-repository.port';

@Injectable()
export class PrismaHrMemoRepository implements HrMemoRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createIfAbsent(
    data: CreateHrMemoData,
    tx?: Prisma.TransactionClient,
  ): Promise<{ memo: HrMemo; created: boolean }> {
    const client = tx ?? this.prisma;
    const inserted = await client.hrMemo.createMany({
      data: [
        {
          organizationId: data.organizationId,
          employeeId: data.employeeId,
          kind: data.kind,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          violationNumber: data.violationNumber,
          reason: data.reason,
          issuedOn: data.issuedOn,
        },
      ],
      skipDuplicates: true,
    });
    const memo = await client.hrMemo.findUniqueOrThrow({
      where: { sourceType_sourceId: { sourceType: data.sourceType, sourceId: data.sourceId } },
    });
    return { memo, created: inserted.count > 0 };
  }

  async findByEmployee(employeeId: string, limit?: number, tx?: Prisma.TransactionClient): Promise<HrMemo[]> {
    const client = tx ?? this.prisma;
    return client.hrMemo.findMany({
      where: { employeeId },
      orderBy: [{ issuedOn: 'desc' }, { createdAt: 'desc' }],
      ...(limit ? { take: limit } : {}),
    });
  }
}
