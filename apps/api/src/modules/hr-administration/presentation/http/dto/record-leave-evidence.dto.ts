import { IsIn, IsString, IsUrl, MaxLength } from 'class-validator';
import { LEAVE_EVIDENCE_CONTENT_TYPES } from '../../../domain/hr-administration-rules';

export class RecordLeaveEvidenceDto {
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  objectUrl!: string;

  @IsIn(LEAVE_EVIDENCE_CONTENT_TYPES)
  contentType!: (typeof LEAVE_EVIDENCE_CONTENT_TYPES)[number];
}
