import { Injectable } from '@nestjs/common';
import {
  ReservationDocumentContentType,
  ReservationDocumentStoragePort,
  ReservationDocumentType,
} from '../../application/ports/reservation-document-storage.port';
import { LocalStorageService, getLocalStorageService } from '../../../../common/storage/local-storage.service';

const EXTENSION_BY_CONTENT_TYPE: Record<ReservationDocumentContentType, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

/** Driver local (solo desarrollo) de GcsReservationDocumentService: misma clave de objeto. */
@Injectable()
export class LocalReservationDocumentService implements ReservationDocumentStoragePort {
  constructor(private readonly storage: LocalStorageService = getLocalStorageService()) {}

  async generateSignedUploadUrl(params: {
    companyId: string;
    reservationId: string;
    documentType: ReservationDocumentType;
    contentType: ReservationDocumentContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string }> {
    const ext = EXTENSION_BY_CONTENT_TYPE[params.contentType];
    const key = `reservation-documents/${params.companyId}/${params.reservationId}/${params.documentType.toLowerCase()}/${crypto.randomUUID()}.${ext}`;
    const { uploadUrl, objectUrl } = this.storage.createUploadUrl(key, params.contentType);
    return { uploadUrl, objectUrl };
  }
}
