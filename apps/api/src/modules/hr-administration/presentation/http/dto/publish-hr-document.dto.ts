import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const VALID_CATEGORIES = ['REGULATION', 'POLICY', 'FORMAT'] as const;

export class PublishHrDocumentDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsIn(VALID_CATEGORIES)
  category!: 'REGULATION' | 'POLICY' | 'FORMAT';

  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  fileHash?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  sizeBytes?: number | null;
}

export class ListActiveHrDocumentsQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsIn(VALID_CATEGORIES)
  category?: 'REGULATION' | 'POLICY' | 'FORMAT';
}
