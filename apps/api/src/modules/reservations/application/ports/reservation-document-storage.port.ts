export type ReservationDocumentContentType =
  | 'image/jpeg'
  | 'image/webp'
  | 'image/png'
  | 'application/pdf';

export type ReservationDocumentType = 'PAYMENT_VOUCHER' | 'ID_DOCUMENT' | 'OTHER';

export abstract class ReservationDocumentStoragePort {
  abstract generateSignedUploadUrl(params: {
    companyId: string;
    reservationId: string;
    documentType: ReservationDocumentType;
    contentType: ReservationDocumentContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string }>;
}
