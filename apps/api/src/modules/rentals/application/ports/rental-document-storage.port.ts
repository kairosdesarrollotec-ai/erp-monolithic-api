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
  /** Decision 8 (22-oct-2026): comprobante del cobro de la garantia (voucherDocumentId de formalize-contract). */
  | 'PAYMENT_VOUCHER'
  /** Tercera via (BR-ALQ-004, DAT-ALQ-008): documento de responsabilidad firmado en vez de notaria. */
  | 'RESPONSIBILITY_DOCUMENT'
  | 'OTHER';

export abstract class RentalDocumentStoragePort {
  abstract generateSignedUploadUrl(params: {
    companyId: string;
    rentalId: string;
    documentType: RentalDocumentType;
    contentType: RentalDocumentContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string }>;
}
