import { Injectable } from '@nestjs/common';
import {
  ReturnEvidenceContentType,
  ReturnEvidenceStoragePort,
} from '../../application/ports/return-evidence-storage.port';
import { ReturnEvidenceType } from '../../domain/return-status';
import { localDevStorageBaseUrl } from '../../../../common/storage/local-dev-storage';

const TTL_MS = 15 * 60 * 1000;
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

/** Solo desarrollo (LOCAL_STORAGE_ENABLED=true): misma forma de objectKey que GCS, URL contra /dev-storage de esta API. */
@Injectable()
export class LocalReturnEvidenceService implements ReturnEvidenceStoragePort {
  async generateSignedUploadUrl(params: {
    companyId: string;
    returnId: string;
    type: ReturnEvidenceType;
    zone: string;
    contentType: ReturnEvidenceContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string; expiresAt: Date }> {
    const ext = EXTENSION_BY_CONTENT_TYPE[params.contentType] ?? 'bin';
    const cleanZone = params.zone.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const rand = Math.random().toString(36).slice(2, 8);
    const objectKey = `companies/${params.companyId}/returns/${params.returnId}/${params.type.toLowerCase()}_${cleanZone}_${Date.now()}_${rand}.${ext}`;
    const url = `${localDevStorageBaseUrl()}${objectKey}`;
    return { uploadUrl: url, objectUrl: url, expiresAt: new Date(Date.now() + TTL_MS) };
  }
}
