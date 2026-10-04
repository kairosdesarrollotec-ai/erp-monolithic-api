import { IsIn, IsInt, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RentalDocumentContentType, RentalDocumentType } from '../../../application/ports/rental-document-storage.port';

const DOCUMENT_TYPES: RentalDocumentType[] = [
  'LICENSE',
  'ID_DOCUMENT',
  'PROOF_OF_ADDRESS',
  'BANK_STATEMENT',
  'OTHER',
];

const CONTENT_TYPES: RentalDocumentContentType[] = [
  'image/jpeg',
  'image/webp',
  'image/png',
  'application/pdf',
];

export class RequestRentalDocumentUploadSessionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(DOCUMENT_TYPES)
  documentType!: RentalDocumentType;

  @IsIn(CONTENT_TYPES)
  contentType!: RentalDocumentContentType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  contentLength!: number;
}
