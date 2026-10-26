import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import {
  ReservationDocumentContentType,
  ReservationDocumentStoragePort,
  ReservationDocumentType,
} from '../../application/ports/reservation-document-storage.port';

const EXTENSION_BY_CONTENT_TYPE: Record<ReservationDocumentContentType, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png': 'png',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

@Injectable()
export class GcsReservationDocumentService implements ReservationDocumentStoragePort {
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
    reservationId: string;
    documentType: ReservationDocumentType;
    contentType: ReservationDocumentContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string }> {
    if (!this.storage || !this.bucketName) {
      throw new ServiceUnavailableException(
        'GCS_BUCKET_NAME (o GCS_CLIENT_EMAIL / GCS_PRIVATE_KEY) no están configurados. Revisa las variables de entorno.',
      );
    }

    const ext = EXTENSION_BY_CONTENT_TYPE[params.contentType];
    const objectKey = `reservation-documents/${params.companyId}/${params.reservationId}/${params.documentType.toLowerCase()}/${crypto.randomUUID()}.${ext}`;

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
