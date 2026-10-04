import { IsIn, IsString, IsUUID } from 'class-validator';
import { ReservationDocumentType } from '../../../application/ports/reservation-document-storage.port';

const DOCUMENT_TYPES: ReservationDocumentType[] = ['PAYMENT_VOUCHER', 'ID_DOCUMENT', 'OTHER'];

export class RecordReservationDocumentDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(DOCUMENT_TYPES)
  documentType!: ReservationDocumentType;

  @IsString()
  objectUrl!: string;
}
