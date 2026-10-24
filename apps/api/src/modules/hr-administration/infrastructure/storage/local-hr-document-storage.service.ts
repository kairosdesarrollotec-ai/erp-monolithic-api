import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { HrDocumentStoragePort } from '../../application/ports/hr-document-storage.port';
import * as fs from 'fs';
import * as path from 'path';

const UPLOAD_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class LocalHrDocumentStorageService implements HrDocumentStoragePort {
  private readonly storage: Storage | null;
  private readonly bucketName: string | null;
  private readonly localDir: string;

  constructor() {
    const bucketName = process.env.GCS_BUCKET_NAME;
    const clientEmail = process.env.GCS_CLIENT_EMAIL ?? process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GCS_PRIVATE_KEY ?? process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (bucketName && clientEmail && privateKey && projectId) {
      this.bucketName = bucketName;
      this.storage = new Storage({ projectId, credentials: { client_email: clientEmail, private_key: privateKey } });
    } else {
      this.storage = null;
      this.bucketName = null;
    }

    this.localDir = process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), 'uploads', 'hr-documents');
  }

  async generateUploadUrl(params: {
    companyId: string;
    code: string;
    fileName: string;
    contentType: string;
  }): Promise<{ uploadUrl: string; objectUrl: string }> {
    const sanitizedCode = params.code.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `companies/${params.companyId}/hr-documents/${sanitizedCode}_${Date.now()}_${sanitizedName}`;

    if (this.storage && this.bucketName) {
      const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
      const [uploadUrl] = await this.storage.bucket(this.bucketName).file(objectKey).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: expiresAt,
        contentType: params.contentType,
      });
      return { uploadUrl, objectUrl: `https://storage.googleapis.com/${this.bucketName}/${objectKey}` };
    }

    // Local / Dev fallback
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    return {
      uploadUrl: `${baseUrl}/dev-storage/hr-documents/${objectKey}`,
      objectUrl: `${baseUrl}/uploads/hr-documents/${objectKey}`,
    };
  }

  async saveDocumentLocally(params: {
    companyId: string;
    code: string;
    fileName: string;
    content: Buffer;
  }): Promise<{ objectUrl: string }> {
    const targetDir = path.join(this.localDir, params.companyId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const sanitizedCode = params.code.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetFile = path.join(targetDir, `${sanitizedCode}_${params.fileName}`);
    fs.writeFileSync(targetFile, params.content);

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    return { objectUrl: `${baseUrl}/uploads/hr-documents/${params.companyId}/${sanitizedCode}_${params.fileName}` };
  }
}
