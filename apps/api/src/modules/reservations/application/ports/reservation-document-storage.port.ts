export type ReservationDocumentContentType =
  | 'image/jpeg'
  | 'image/webp'
  | 'image/png'
  | 'application/pdf'
  | 'video/mp4'
  | 'video/webm';

export type ReservationDocumentType =
  | 'PAYMENT_VOUCHER'
  | 'ID_DOCUMENT'
  | 'VIDEO_360'
  | 'SIGNED_ACCEPTANCE'
  | 'OTHER';

export abstract class ReservationDocumentStoragePort {
  abstract generateSignedUploadUrl(params: {
    companyId: string;
    reservationId: string;
    documentType: ReservationDocumentType;
    contentType: ReservationDocumentContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string }>;
}
