import { Injectable } from '@nestjs/common';
import {
  RentalEvidenceContentType,
  RentalEvidenceStoragePort,
} from '../../application/ports/rental-evidence-storage.port';
import { RentalEvidenceKind } from '../../application/ports/rental-evidence-repository.port';
import { LocalStorageService, getLocalStorageService } from '../../../../common/storage/local-storage.service';

const EXTENSION_BY_CONTENT_TYPE: Record<RentalEvidenceContentType, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

/** Driver local (solo desarrollo) de GcsRentalEvidenceService: misma clave de objeto. */
@Injectable()
export class LocalRentalEvidenceService implements RentalEvidenceStoragePort {
  constructor(private readonly storage: LocalStorageService = getLocalStorageService()) {}

  async generateSignedUploadUrl(params: {
    companyId: string;
    rentalId: string;
    type: RentalEvidenceKind;
    zone: string;
    contentType: RentalEvidenceContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string }> {
    const ext = EXTENSION_BY_CONTENT_TYPE[params.contentType];
    const zoneSlug = params.zone.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const key = `rental-evidence/${params.companyId}/${params.rentalId}/${params.type.toLowerCase()}/${zoneSlug}/${crypto.randomUUID()}.${ext}`;
    const { uploadUrl, objectUrl } = this.storage.createUploadUrl(key, params.contentType);
    return { uploadUrl, objectUrl };
  }
}
