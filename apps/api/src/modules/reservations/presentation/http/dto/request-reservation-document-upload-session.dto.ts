import { IsIn, IsInt, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReservationDocumentContentType, ReservationDocumentType } from '../../../application/ports/reservation-document-storage.port';

const DOCUMENT_TYPES: ReservationDocumentType[] = ['PAYMENT_VOUCHER', 'ID_DOCUMENT', 'OTHER'];

const CONTENT_TYPES: ReservationDocumentContentType[] = [
  'image/jpeg',
  'image/webp',
  'image/png',
  'application/pdf',
];

export class RequestReservationDocumentUploadSessionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(DOCUMENT_TYPES)
  documentType!: ReservationDocumentType;

  @IsIn(CONTENT_TYPES)
  contentType!: ReservationDocumentContentType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  contentLength!: number;
}
