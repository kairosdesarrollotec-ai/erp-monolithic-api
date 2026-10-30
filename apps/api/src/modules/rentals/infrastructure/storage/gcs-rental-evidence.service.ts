import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import {
  RentalEvidenceContentType,
  RentalEvidenceStoragePort,
} from '../../application/ports/rental-evidence-storage.port';
import { RentalEvidenceKind } from '../../application/ports/rental-evidence-repository.port';
import { isLocalDevStorageEnabled, localDevUploadTarget } from '../../../../common/storage/local-dev-storage';

const EXTENSION_BY_CONTENT_TYPE: Record<RentalEvidenceContentType, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

/**
 * ALQ-09 - mismo patron GCS que GcsVehiclePhotoService (Fleet, PROP-008 /
 * ADR-KAI-005): URL firmada v4 de escritura, mismo bucket y credenciales
 * (GCS_BUCKET_NAME / GCS_CLIENT_EMAIL / GCS_PRIVATE_KEY), cambia solo el
 * prefijo del object key para separar la evidencia de entrega por
 * alquiler/tipo/zona.
 */
@Injectable()
export class GcsRentalEvidenceService implements RentalEvidenceStoragePort {
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
    rentalId: string;
    type: RentalEvidenceKind;
    zone: string;
    contentType: RentalEvidenceContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string }> {
    const localMode = (!this.storage || !this.bucketName) && isLocalDevStorageEnabled();
    if (!localMode && (!this.storage || !this.bucketName)) {
      throw new ServiceUnavailableException(
        'GCS_BUCKET_NAME (o GCS_CLIENT_EMAIL / GCS_PRIVATE_KEY) no están configurados. Revisa las variables de entorno.',
      );
    }

    const ext = EXTENSION_BY_CONTENT_TYPE[params.contentType];
    const zoneSlug = params.zone.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const objectKey = `rental-evidence/${params.companyId}/${params.rentalId}/${params.type.toLowerCase()}/${zoneSlug}/${crypto.randomUUID()}.${ext}`;

    if (localMode) {
      // Solo desarrollo (LOCAL_STORAGE_ENABLED=true): sin bucket de GCS.
      return localDevUploadTarget(objectKey);
    }
    if (!this.storage || !this.bucketName) {
      throw new ServiceUnavailableException('Almacenamiento no configurado.');
    }

    const [uploadUrl] = await this.storage
      .bucket(this.bucketName)
      .file(objectKey)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: params.contentType,
      });

    const objectUrl = `https://storage.googleapis.com/${this.bucketName}/${objectKey}`;
    return { uploadUrl, objectUrl };
  }
}
