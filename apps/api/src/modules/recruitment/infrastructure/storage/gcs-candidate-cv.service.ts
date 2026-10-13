import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import {
  CandidateCvObjectMetadata,
  CandidateCvScope,
  CandidateCvStoragePort,
  CandidateCvUploadSession,
} from '../../application/ports/candidate-cv-storage.port';

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const UPLOAD_TTL_MS = 15 * 60 * 1000;
const READ_TTL_MS = 5 * 60 * 1000;
const OBJECT_ID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/**
 * Adaptador GCS del CV del candidato (mismo patron que Flota / Reservas: URL firmada v4, bucket privado).
 * Clave de objeto: `candidate-cvs/{companyId}/{candidateId}/{uuid}.{ext}`.
 * La lectura se firma con vida corta y `Content-Disposition: inline` para el visor.
 */
@Injectable()
export class GcsCandidateCvService implements CandidateCvStoragePort {
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

  private requireStorage(): { storage: Storage; bucketName: string } {
    if (!this.storage || !this.bucketName) {
      throw new ServiceUnavailableException(
        'GCS_BUCKET_NAME (o GCS_CLIENT_EMAIL / GCS_PRIVATE_KEY) no están configurados. Revisa las variables de entorno.',
      );
    }
    return { storage: this.storage, bucketName: this.bucketName };
  }

  private objectKeyOf(objectUrl: string, bucketName: string): string | null {
    const prefix = `https://storage.googleapis.com/${bucketName}/`;
    return objectUrl.startsWith(prefix) ? objectUrl.slice(prefix.length) : null;
  }

  async generateSignedUploadUrl(
    params: CandidateCvScope & { contentType: string; maxBytes: number },
  ): Promise<CandidateCvUploadSession> {
    const { storage, bucketName } = this.requireStorage();
    const ext = EXTENSION_BY_CONTENT_TYPE[params.contentType];
    if (!ext) {
      throw new ServiceUnavailableException('Tipo de archivo no soportado para el CV.');
    }
    const objectKey = `candidate-cvs/${params.companyId}/${params.candidateId}/${crypto.randomUUID()}.${ext}`;
    const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
    // El tope de tamano viaja firmado: GCS rechaza el PUT si el cuerpo lo excede.
    const uploadHeaders = {
      'Content-Type': params.contentType,
      'x-goog-content-length-range': `0,${params.maxBytes}`,
    };

    const [uploadUrl] = await storage
      .bucket(bucketName)
      .file(objectKey)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: expiresAt,
        contentType: params.contentType,
        extensionHeaders: { 'x-goog-content-length-range': uploadHeaders['x-goog-content-length-range'] },
      });

    return { uploadUrl, objectUrl: `https://storage.googleapis.com/${bucketName}/${objectKey}`, expiresAt, uploadHeaders };
  }

  isOwnedObjectUrl(objectUrl: string, scope: CandidateCvScope): boolean {
    if (!this.bucketName) {
      return false;
    }
    const key = this.objectKeyOf(objectUrl, this.bucketName);
    if (!key) {
      return false;
    }
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `^candidate-cvs/${escape(scope.companyId)}/${escape(scope.candidateId)}/${OBJECT_ID_PATTERN}\\.(pdf|docx|jpg|png)$`,
    );
    return pattern.test(key);
  }

  async getObjectMetadata(objectUrl: string): Promise<CandidateCvObjectMetadata | null> {
    const { storage, bucketName } = this.requireStorage();
    const key = this.objectKeyOf(objectUrl, bucketName);
    if (!key) {
      return null;
    }
    const file = storage.bucket(bucketName).file(key);
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }
    const [metadata] = await file.getMetadata();
    return {
      sizeBytes: Number(metadata.size ?? 0),
      contentType: typeof metadata.contentType === 'string' ? metadata.contentType : null,
    };
  }

  async generateSignedReadUrl(
    objectUrl: string,
    params: { fileName: string; contentType: string },
  ): Promise<{ url: string; expiresAt: Date }> {
    const { storage, bucketName } = this.requireStorage();
    const key = this.objectKeyOf(objectUrl, bucketName);
    if (!key) {
      throw new ServiceUnavailableException('El CV no está en el almacenamiento configurado.');
    }
    const expiresAt = new Date(Date.now() + READ_TTL_MS);
    const safeName = params.fileName.replace(/["\\\r\n]/g, '_');
    const [url] = await storage
      .bucket(bucketName)
      .file(key)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresAt,
        responseType: params.contentType,
        responseDisposition: `inline; filename="${safeName}"`,
      });
    return { url, expiresAt };
  }
}
