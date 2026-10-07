import { Injectable } from '@nestjs/common';
import {
  RentalDocumentContentType,
  RentalDocumentStoragePort,
  RentalDocumentType,
} from '../../application/ports/rental-document-storage.port';
import { LocalStorageService, getLocalStorageService } from '../../../../common/storage/local-storage.service';

const EXTENSION_BY_CONTENT_TYPE: Record<RentalDocumentContentType, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

/** Driver local (solo desarrollo) de GcsRentalDocumentService: misma clave de objeto. */
@Injectable()
export class LocalRentalDocumentService implements RentalDocumentStoragePort {
  constructor(private readonly storage: LocalStorageService = getLocalStorageService()) {}

  async generateSignedUploadUrl(params: {
    companyId: string;
    rentalId: string;
    documentType: RentalDocumentType;
    contentType: RentalDocumentContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string }> {
    const ext = EXTENSION_BY_CONTENT_TYPE[params.contentType];
    const key = `rental-documents/${params.companyId}/${params.rentalId}/${params.documentType.toLowerCase()}/${crypto.randomUUID()}.${ext}`;
    const { uploadUrl, objectUrl } = this.storage.createUploadUrl(key, params.contentType);
    return { uploadUrl, objectUrl };
  }
}
