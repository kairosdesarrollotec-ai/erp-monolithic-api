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

  /** Documento de la reserva por id (null si no existe o pertenece a otra reserva). */
  abstract findById(
    documentId: string,
    reservationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationDocumentRecord | null>;

  /** Cantidad de documentos del cliente subidos (excluye el comprobante de pago). */
  abstract countCustomerDocuments(reservationId: string, tx?: Prisma.TransactionClient): Promise<number>;

  /** Verifica si la reserva tiene al menos un documento subido de determinado tipo. */
  abstract hasDocumentType(
    reservationId: string,
    documentType: ReservationDocumentType,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean>;

  /** Obtiene un documento de la reserva por tipo (null si no existe). */
  abstract findByType(
    reservationId: string,
    documentType: ReservationDocumentType,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationDocumentRecord | null>;
}

