import { IsIn, IsInt, IsNotEmpty, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RETURN_EVIDENCE_TYPES, ReturnEvidenceType } from '../../../domain/return-status';
import { MAX_RETURN_EVIDENCE_BYTES } from '../../../domain/return-evidence-requirements';
import { ReturnEvidenceContentType } from '../../../application/ports/return-evidence-storage.port';

export const RETURN_EVIDENCE_CONTENT_TYPES: readonly ReturnEvidenceContentType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
];

export class RequestReturnEvidenceUploadSessionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(RETURN_EVIDENCE_TYPES, { message: 'type must be PHOTO or VIDEO' })
  type!: ReturnEvidenceType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  zone!: string;

  @IsIn(RETURN_EVIDENCE_CONTENT_TYPES, {
    message: `contentType must be one of: ${RETURN_EVIDENCE_CONTENT_TYPES.join(', ')}`,
  })
  contentType!: ReturnEvidenceContentType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_RETURN_EVIDENCE_BYTES)
  contentLength!: number;
}
