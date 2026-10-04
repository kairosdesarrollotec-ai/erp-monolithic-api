import type { Prisma } from '@prisma/client';
import { ReservationDocumentType } from './reservation-document-storage.port';

export interface ReservationDocumentRecord {
  id: string;
  reservationId: string;
  documentType: ReservationDocumentType;
  objectUrl: string;
  createdAt: Date;
}

export interface RecordReservationDocumentInput {
  reservationId: string;
  organizationId: string;
  documentType: ReservationDocumentType;
  objectUrl: string;
}

export abstract class ReservationDocumentRepositoryPort {
  abstract record(
    input: RecordReservationDocumentInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationDocumentRecord>;

  abstract list(reservationId: string, organizationId: string): Promise<ReservationDocumentRecord[]>;
}
