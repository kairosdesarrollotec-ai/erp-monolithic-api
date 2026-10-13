import { IsIn, IsInt, IsString, IsUUID, Max, Min } from 'class-validator';
import { CANDIDATE_CV_CONTENT_TYPES, CANDIDATE_CV_MAX_BYTES } from '../../../domain/recruitment-rules';

export class RequestCandidateCvUploadSessionDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsString()
  @IsIn([...CANDIDATE_CV_CONTENT_TYPES])
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(CANDIDATE_CV_MAX_BYTES)
  contentLength!: number;
}
