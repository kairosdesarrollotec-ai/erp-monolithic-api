import { ReturnEvidenceType } from '../../domain/return-status';

export type ReturnEvidenceContentType = 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'video/webm';

export abstract class ReturnEvidenceStoragePort {
  abstract generateSignedUploadUrl(params: {
    companyId: string;
    returnId: string;
    type: ReturnEvidenceType;
    zone: string;
    contentType: ReturnEvidenceContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string; expiresAt: Date }>;
}
