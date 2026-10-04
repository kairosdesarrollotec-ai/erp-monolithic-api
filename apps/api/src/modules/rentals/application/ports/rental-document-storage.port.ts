export type RentalDocumentContentType =
  | 'image/jpeg'
  | 'image/webp'
  | 'image/png'
  | 'application/pdf';

export type RentalDocumentType =
  | 'LICENSE'
  | 'ID_DOCUMENT'
  | 'PROOF_OF_ADDRESS'
  | 'BANK_STATEMENT'
  | 'OTHER';

export abstract class RentalDocumentStoragePort {
  abstract generateSignedUploadUrl(params: {
    companyId: string;
    rentalId: string;
    documentType: RentalDocumentType;
    contentType: RentalDocumentContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string }>;
}
