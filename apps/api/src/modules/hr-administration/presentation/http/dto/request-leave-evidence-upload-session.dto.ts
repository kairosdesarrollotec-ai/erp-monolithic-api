import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { LEAVE_EVIDENCE_CONTENT_TYPES, MAX_LEAVE_EVIDENCE_BYTES } from '../../../domain/hr-administration-rules';

export class RequestLeaveEvidenceUploadSessionDto {
  @IsIn(LEAVE_EVIDENCE_CONTENT_TYPES, {
    message: `contentType must be one of: ${LEAVE_EVIDENCE_CONTENT_TYPES.join(', ')}`,
  })
  contentType!: (typeof LEAVE_EVIDENCE_CONTENT_TYPES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LEAVE_EVIDENCE_BYTES)
  contentLength!: number;
}
