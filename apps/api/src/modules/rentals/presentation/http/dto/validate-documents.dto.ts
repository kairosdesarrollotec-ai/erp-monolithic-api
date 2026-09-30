import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class ValidateDocumentsDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsBoolean()
  identityDocumentValid?: boolean;

  @IsOptional()
  @IsBoolean()
  driverLicenseValid?: boolean;

  @IsOptional()
  @IsBoolean()
  addressOrStayProofValid?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
