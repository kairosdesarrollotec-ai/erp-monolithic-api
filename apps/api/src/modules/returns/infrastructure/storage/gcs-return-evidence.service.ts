import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import {
  ReturnEvidenceContentType,
  ReturnEvidenceStoragePort,
} from '../../application/ports/return-evidence-storage.port';
import { ReturnEvidenceType } from '../../domain/return-status';
import { ReturnStorageUnavailableError } from '../../domain/return-errors';

const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

@Injectable()
export class GcsReturnEvidenceService implements ReturnEvidenceStoragePort {
  private readonly storage: Storage | null;
  private readonly bucketName: string | null;

  constructor() {
    const bucketName = process.env.GCS_BUCKET_NAME;
    const clientEmail = process.env.GCS_CLIENT_EMAIL ?? process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GCS_PRIVATE_KEY ?? process.env.FIREBASE_PRIVATE_KEY)?.replace(
      /\\n/g,
      '\n',
    );
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (!bucketName || !clientEmail || !privateKey || !projectId) {
      this.storage = null;
      this.bucketName = null;
      return;
    }

    this.bucketName = bucketName;
    this.storage = new Storage({
      projectId,
      credentials: { client_email: clientEmail, private_key: privateKey },
    });
  }

  async generateSignedUploadUrl(params: {
    companyId: string;
    returnId: string;
    type: ReturnEvidenceType;
    zone: string;
    contentType: ReturnEvidenceContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string; expiresAt: Date }> {
    if (!this.storage || !this.bucketName) {
      throw new ReturnStorageUnavailableError();
    }

    const ext = EXTENSION_BY_CONTENT_TYPE[params.contentType] ?? 'bin';
    const timestamp = Date.now();
    const cleanZone = params.zone.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const objectKey = `companies/${params.companyId}/returns/${params.returnId}/${params.type.toLowerCase()}_${cleanZone}_${timestamp}.${ext}`;

    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS);
    const [uploadUrl] = await this.storage
      .bucket(this.bucketName)
      .file(objectKey)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: expiresAt,
        contentType: params.contentType,
      });

    const objectUrl = `https://storage.googleapis.com/${this.bucketName}/${objectKey}`;

    return { uploadUrl, objectUrl, expiresAt };
  }
}
