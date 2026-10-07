import { Injectable } from '@nestjs/common';
import {
  ReturnEvidenceContentType,
  ReturnEvidenceStoragePort,
} from '../../application/ports/return-evidence-storage.port';
import { ReturnEvidenceType } from '../../domain/return-status';
import { LocalStorageService, getLocalStorageService } from '../../../../common/storage/local-storage.service';

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

/** Driver local (solo desarrollo) de GcsReturnEvidenceService: misma clave de objeto. */
@Injectable()
export class LocalReturnEvidenceService implements ReturnEvidenceStoragePort {
  constructor(private readonly storage: LocalStorageService = getLocalStorageService()) {}

  async generateSignedUploadUrl(params: {
    companyId: string;
    returnId: string;
    type: ReturnEvidenceType;
    zone: string;
    contentType: ReturnEvidenceContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string; expiresAt: Date }> {
    const ext = EXTENSION_BY_CONTENT_TYPE[params.contentType] ?? 'bin';
    const cleanZone = params.zone.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const key = `companies/${params.companyId}/returns/${params.returnId}/${params.type.toLowerCase()}_${cleanZone}_${Date.now()}.${ext}`;
    return this.storage.createUploadUrl(key, params.contentType);
  }
}
