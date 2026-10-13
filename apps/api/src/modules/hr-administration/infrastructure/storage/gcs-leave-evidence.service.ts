import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { LeaveEvidenceStoragePort } from '../../application/ports/leave-evidence-storage.port';
import type { LeaveEvidenceContentType } from '../../domain/hr-administration-rules';
import { LeaveEvidenceStorageUnavailableError } from '../../domain/hr-administration-errors';

const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

const EXTENSION_BY_CONTENT_TYPE: Record<LeaveEvidenceContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

@Injectable()
export class GcsLeaveEvidenceService implements LeaveEvidenceStoragePort {
  private readonly storage: Storage | null;
  private readonly bucketName: string | null;

  constructor() {
    const bucketName = process.env.GCS_BUCKET_NAME;
    const clientEmail = process.env.GCS_CLIENT_EMAIL ?? process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GCS_PRIVATE_KEY ?? process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (!bucketName || !clientEmail || !privateKey || !projectId) {
      this.storage = null;
      this.bucketName = null;
      return;
    }

    this.bucketName = bucketName;
    this.storage = new Storage({ projectId, credentials: { client_email: clientEmail, private_key: privateKey } });
  }

  async generateSignedUploadUrl(params: {
    companyId: string;
    leaveId: string;
    contentType: LeaveEvidenceContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string; expiresAt: Date }> {
    if (!this.storage || !this.bucketName) {
      throw new LeaveEvidenceStorageUnavailableError();
    }

    const objectKey = `companies/${params.companyId}/leaves/${params.leaveId}/evidence_${Date.now()}.${EXTENSION_BY_CONTENT_TYPE[params.contentType]}`;
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS);
    const [uploadUrl] = await this.storage.bucket(this.bucketName).file(objectKey).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresAt,
      contentType: params.contentType,
    });

    return { uploadUrl, objectUrl: `https://storage.googleapis.com/${this.bucketName}/${objectKey}`, expiresAt };
  }
}
