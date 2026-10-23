import { IsIn, IsString, IsUUID } from 'class-validator';
import { RentalDocumentType } from '../../../application/ports/rental-document-storage.port';

const DOCUMENT_TYPES: RentalDocumentType[] = [
  'LICENSE',
  'ID_DOCUMENT',
  'PROOF_OF_ADDRESS',
  'BANK_STATEMENT',
  'PAYMENT_VOUCHER',
  'RESPONSIBILITY_DOCUMENT',
  'OTHER',
];

export class RecordRentalDocumentDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(DOCUMENT_TYPES)
  documentType!: RentalDocumentType;

  @IsString()
  objectUrl!: string;
}
