import { IsIn, IsString, IsUUID, IsUrl } from 'class-validator';
import { RENTAL_EVIDENCE_ZONES } from './request-evidence-upload-session.dto';
import { isLocalDevStorageEnabled } from '../../../../../common/storage/local-dev-storage';

export class RecordEvidenceDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(['PHOTO', 'VIDEO'], { message: 'type must be PHOTO or VIDEO' })
  type!: 'PHOTO' | 'VIDEO';

  @IsIn(RENTAL_EVIDENCE_ZONES, {
    message: `zone must be one of: ${RENTAL_EVIDENCE_ZONES.join(', ')}`,
  })
  zone!: (typeof RENTAL_EVIDENCE_ZONES)[number];

  @IsString()
  @IsUrl({ require_protocol: true, require_tld: !isLocalDevStorageEnabled() })
  objectUrl!: string;
}
