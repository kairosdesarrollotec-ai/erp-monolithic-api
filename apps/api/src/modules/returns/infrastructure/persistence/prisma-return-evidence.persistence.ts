import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  AddEvidenceInput,
  ReturnEvidenceCounts,
  ReturnEvidenceRecord,
  ReturnScope,
} from '../../application/ports/return-repository.port';
import { toReturnEvidenceRecord } from './return-persistence.mapper';

function evidenceScopeWhere(returnId: string, scope: ReturnScope): Prisma.ReturnEvidenceWhereInput {
  return {
    returnId,
    organizationId: scope.organizationId,
    operatingCompanyId: scope.operatingCompanyId,
  };
}

/** Persistencia de la subentidad ReturnEvidence (TR-08 / BR-DEV-009). */
@Injectable()
export class PrismaReturnEvidencePersistence {
  constructor(private readonly prisma: PrismaService) {}

  async add(input: AddEvidenceInput, tx?: Prisma.TransactionClient): Promise<ReturnEvidenceRecord> {
    const client = tx ?? this.prisma;
    const row = await client.returnEvidence.create({
      data: {
        organizationId: input.organizationId,
        operatingCompanyId: input.operatingCompanyId,
        returnId: input.returnId,
        type: input.type,
        zone: input.zone,
        objectUrl: input.objectUrl,
        uploadedBy: input.uploadedBy,
      },
    });
    return toReturnEvidenceRecord(row);
  }

  async list(returnId: string, scope: ReturnScope): Promise<ReturnEvidenceRecord[]> {
    const rows = await this.prisma.returnEvidence.findMany({
      where: evidenceScopeWhere(returnId, scope),
      orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toReturnEvidenceRecord);
  }

  async countByType(
    returnId: string,
    scope: ReturnScope,
    tx?: Prisma.TransactionClient,
  ): Promise<ReturnEvidenceCounts> {
    const client = tx ?? this.prisma;
    const [photos, videos] = await Promise.all([
      client.returnEvidence.count({ where: { ...evidenceScopeWhere(returnId, scope), type: 'PHOTO' } }),
      client.returnEvidence.count({ where: { ...evidenceScopeWhere(returnId, scope), type: 'VIDEO' } }),
    ]);
    return { photos, videos };
  }
}
