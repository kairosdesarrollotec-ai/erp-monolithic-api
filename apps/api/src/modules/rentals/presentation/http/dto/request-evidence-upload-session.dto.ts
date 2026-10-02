import { IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const RENTAL_EVIDENCE_ZONES = [
  'FRONTAL',
  'LATERAL_IZQUIERDO',
  'LATERAL_DERECHO',
  'POSTERIOR',
  'INTERIOR',
] as const;

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export class RequestEvidenceUploadSessionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(['PHOTO', 'VIDEO'], { message: 'type must be PHOTO or VIDEO' })
  type!: 'PHOTO' | 'VIDEO';

  @IsIn(RENTAL_EVIDENCE_ZONES, {
    message: `zone must be one of: ${RENTAL_EVIDENCE_ZONES.join(', ')}`,
  })
  zone!: (typeof RENTAL_EVIDENCE_ZONES)[number];

  @IsIn(['image/jpeg', 'image/webp', 'video/mp4', 'video/webm'], {
    message: 'contentType must be image/jpeg, image/webp, video/mp4 or video/webm',
  })
  contentType!: 'image/jpeg' | 'image/webp' | 'video/mp4' | 'video/webm';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_VIDEO_BYTES)
  contentLength!: number;
}
