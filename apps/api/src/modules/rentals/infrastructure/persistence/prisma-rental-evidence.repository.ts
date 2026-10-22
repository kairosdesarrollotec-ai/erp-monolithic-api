import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RENTAL_ALCOHOL_TEST_EVIDENCE_ZONE } from '../../domain/alcohol-test-result';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  RentalEvidenceCounts,
  RentalEvidenceRecord,
  RentalEvidenceRepositoryPort,
  RecordRentalEvidenceInput,
} from '../../application/ports/rental-evidence-repository.port';
import { RentalScope } from '../../application/ports/rental-repository.port';

function toRecord(row: {
  id: string;
  rentalId: string;
  type: string;
  zone: string;
  objectUrl: string;
  uploadedBy: string;
  uploadedAt: Date;
}): RentalEvidenceRecord {
  return {
    id: row.id,
    rentalId: row.rentalId,
    type: row.type as 'PHOTO' | 'VIDEO',
    zone: row.zone,
    objectUrl: row.objectUrl,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt,
  };
}

@Injectable()
export class PrismaRentalEvidenceRepository implements RentalEvidenceRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: RecordRentalEvidenceInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalEvidenceRecord> {
    const client = tx ?? this.prisma;
    const row = await client.rentalEvidence.create({
      data: {
        organizationId: input.scope.organizationId,
        operatingCompanyId: input.scope.operatingCompanyId,
        rentalId: input.rentalId,
        type: input.type,
        zone: input.zone,
        objectUrl: input.objectUrl,
        uploadedBy: input.uploadedBy,
      },
    });
    return toRecord(row);
  }

  async countByType(
    rentalId: string,
    scope: RentalScope,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalEvidenceCounts> {
    const client = tx ?? this.prisma;
    const [photos, videos] = await Promise.all([
      client.rentalEvidence.count({
        where: {
          rentalId,
          organizationId: scope.organizationId,
          operatingCompanyId: scope.operatingCompanyId,
          type: 'PHOTO',
          // La foto del alcolimetro (ENTREGA-02) no cuenta para las 35 fotos del checklist.
          zone: { not: RENTAL_ALCOHOL_TEST_EVIDENCE_ZONE },
        },
      }),
      client.rentalEvidence.count({
        where: {
          rentalId,
          organizationId: scope.organizationId,
          operatingCompanyId: scope.operatingCompanyId,
          type: 'VIDEO',
        },
      }),
    ]);
    return { photos, videos };
  }

  async delete(rentalId: string, evidenceId: string, scope: RentalScope, tx?: Prisma.TransactionClient): Promise<boolean> {
    const client = tx ?? this.prisma;
    const result = await client.rentalEvidence.deleteMany({
      where: {
        id: evidenceId,
        rentalId,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
      },
    });
    return result.count > 0;
  }

  async list(rentalId: string, scope: RentalScope): Promise<RentalEvidenceRecord[]> {
    const rows = await this.prisma.rentalEvidence.findMany({
      where: {
        rentalId,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
      },
      orderBy: { uploadedAt: 'asc' },
    });
    return rows.map(toRecord);
  }
}
