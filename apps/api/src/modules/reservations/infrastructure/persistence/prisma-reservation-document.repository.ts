import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  ReservationDocumentRecord,
  ReservationDocumentRepositoryPort,
  RecordReservationDocumentInput,
} from '../../application/ports/reservation-document-repository.port';
import { ReservationDocumentType } from '../../application/ports/reservation-document-storage.port';

function toRecord(row: {
  id: string;
  reservationId: string;
  documentType: string;
  objectUrl: string;
  createdAt: Date;
}): ReservationDocumentRecord {
  return {
    id: row.id,
    reservationId: row.reservationId,
    documentType: row.documentType as ReservationDocumentType,
    objectUrl: row.objectUrl,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class PrismaReservationDocumentRepository implements ReservationDocumentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: RecordReservationDocumentInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationDocumentRecord> {
    const client = tx ?? this.prisma;
    const row = await client.reservationDocument.create({
      data: {
        reservationId: input.reservationId,
        documentType: input.documentType,
        objectUrl: input.objectUrl,
      },
    });
    return toRecord(row);
  }

  async findById(
    documentId: string,
    reservationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationDocumentRecord | null> {
    const client = tx ?? this.prisma;
    const row = await client.reservationDocument.findFirst({ where: { id: documentId, reservationId } });
    return row ? toRecord(row) : null;
  }

  async countCustomerDocuments(reservationId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx ?? this.prisma;
    return client.reservationDocument.count({
      where: { reservationId, documentType: { not: 'PAYMENT_VOUCHER' } },
    });
  }

  async list(reservationId: string, _organizationId: string): Promise<ReservationDocumentRecord[]> {
    const rows = await this.prisma.reservationDocument.findMany({
      where: { reservationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRecord);
  }
}
