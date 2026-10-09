import { Injectable, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { TemplateStoragePort, TemplateUploadUrlParams, TemplateUploadUrlResult } from '../../application/ports/template-storage.port';

/** MIME types permitidos para plantillas (TDD-TPL-ADR-001). */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** Tamaño máximo por defecto: 20 MB (TDD-TPL §7). */
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024; // 20971520

/**
 * TDD-TPL-ADR-001 — Implementación GCS del port de almacenamiento de plantillas.
 * Copia el patrón de gcs-vehicle-photo.service.ts (PROP-008).
 */
@Injectable()
export class GcsTemplateService implements TemplateStoragePort {
  private readonly storage: Storage | null;
  private readonly bucketName: string | null;
  private readonly maxBytes: number;

  constructor() {
    const bucketName = process.env.GCS_BUCKET_NAME;
    const clientEmail = process.env.GCS_CLIENT_EMAIL ?? process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GCS_PRIVATE_KEY ?? process.env.FIREBASE_PRIVATE_KEY)?.replace(
      /\\n/g,
      '\n',
    );
    const projectId = process.env.FIREBASE_PROJECT_ID;

    this.maxBytes = parseInt(process.env.TEMPLATES_UPLOAD_MAX_BYTES ?? String(DEFAULT_MAX_BYTES), 10);

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

  async generateSignedUploadUrl(params: TemplateUploadUrlParams): Promise<TemplateUploadUrlResult> {
    if (!this.storage || !this.bucketName) {
      throw new ServiceUnavailableException(
        'GCS_BUCKET_NAME (o GCS_CLIENT_EMAIL / GCS_PRIVATE_KEY) no están configurados. Revisa las variables de entorno.',
      );
    }

    if (!ALLOWED_MIME_TYPES.has(params.contentType)) {
      throw new UnprocessableEntityException(
        `Tipo de contenido no permitido: ${params.contentType}. Solo se aceptan application/pdf y application/vnd.openxmlformats-officedocument.wordprocessingml.document.`,
      );
    }

    const ext = params.contentType === 'application/pdf' ? 'pdf' : 'docx';
    const objectKey = `templates/${params.companyId}/${params.type}/${crypto.randomUUID()}.${ext}`;
    const expiresInMs = 15 * 60 * 1000;

    const [uploadUrl] = await this.storage
      .bucket(this.bucketName)
      .file(objectKey)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + expiresInMs,
        contentType: params.contentType,
        extensionHeaders: {
          'x-goog-content-length-range': `0,${this.maxBytes}`,
        },
      });

    const objectUrl = `https://storage.googleapis.com/${this.bucketName}/${objectKey}`;
    const expiresAt = new Date(Date.now() + expiresInMs);

    return { uploadUrl, objectUrl, expiresAt };
  }

  isValidGcsUrl(url: string): boolean {
    if (!this.bucketName) return false;
    const prefix = `https://storage.googleapis.com/${this.bucketName}/templates/`;
    return url.startsWith(prefix);
  }
}
