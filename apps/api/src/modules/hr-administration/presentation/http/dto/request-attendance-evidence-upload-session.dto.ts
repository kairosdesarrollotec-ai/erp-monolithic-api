import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import {
  ATTENDANCE_EVIDENCE_CONTENT_TYPES,
  MAX_ATTENDANCE_EVIDENCE_BYTES,
} from '../../../domain/hr-administration-rules';

export class RequestAttendanceEvidenceUploadSessionDto {
  @IsIn(ATTENDANCE_EVIDENCE_CONTENT_TYPES, {
    message: `contentType must be one of: ${ATTENDANCE_EVIDENCE_CONTENT_TYPES.join(', ')}`,
  })
  contentType!: (typeof ATTENDANCE_EVIDENCE_CONTENT_TYPES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ATTENDANCE_EVIDENCE_BYTES)
  contentLength!: number;
}
