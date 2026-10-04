import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  RentalDocumentRecord,
  RentalDocumentRepositoryPort,
  RecordRentalDocumentInput,
} from '../../application/ports/rental-document-repository.port';
import { RentalDocumentType } from '../../application/ports/rental-document-storage.port';
import { RentalScope } from '../../application/ports/rental-repository.port';

function toRecord(row: {
  id: string;
  rentalId: string;
  documentType: string;
  objectUrl: string;
  createdAt: Date;
}): RentalDocumentRecord {
  return {
    id: row.id,
    rentalId: row.rentalId,
    documentType: row.documentType as RentalDocumentType,
    objectUrl: row.objectUrl,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class PrismaRentalDocumentRepository implements RentalDocumentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: RecordRentalDocumentInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalDocumentRecord> {
    const client = tx ?? this.prisma;
    const row = await client.rentalDocument.create({
      data: {
        rentalId: input.rentalId,
        documentType: input.documentType,
        objectUrl: input.objectUrl,
      },
    });
    return toRecord(row);
  }

  async list(rentalId: string, _scope: RentalScope): Promise<RentalDocumentRecord[]> {
    const rows = await this.prisma.rentalDocument.findMany({
      where: { rentalId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRecord);
  }
}
