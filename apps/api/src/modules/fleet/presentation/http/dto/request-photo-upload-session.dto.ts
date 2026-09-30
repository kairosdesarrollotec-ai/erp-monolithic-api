import { IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RequestPhotoUploadSessionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(['image/jpeg', 'image/webp'], {
    message: 'contentType must be image/jpeg or image/webp',
  })
  contentType!: 'image/jpeg' | 'image/webp';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12 * 1024 * 1024) // 12 MB — SDD-00 §16.5
  contentLength!: number;
}
