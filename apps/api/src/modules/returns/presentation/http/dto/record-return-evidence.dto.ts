import { IsIn, IsNotEmpty, IsString, IsUUID, IsUrl, MaxLength } from 'class-validator';
import { isLocalDevStorageEnabled } from '../../../../../common/storage/local-dev-storage';
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
  // En modo local (LOCAL_STORAGE_ENABLED) la URL es http://localhost:..., sin TLD.
  @IsUrl({ require_protocol: true, require_tld: !isLocalDevStorageEnabled() })
  @MaxLength(2048)
  objectUrl!: string;
}
