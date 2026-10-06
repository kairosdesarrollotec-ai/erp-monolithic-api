import { IsIn, IsNotEmpty, IsString, IsUUID, IsUrl, MaxLength } from 'class-validator';
import { RETURN_EVIDENCE_TYPES, ReturnEvidenceType } from '../../../domain/return-status';

export class RecordReturnEvidenceDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(RETURN_EVIDENCE_TYPES, { message: 'type must be PHOTO or VIDEO' })
  type!: ReturnEvidenceType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  zone!: string;

  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  objectUrl!: string;
}
