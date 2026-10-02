import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateContractTemplateDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString()
  @MaxLength(30)
  type!: string;

  /** Opcional: por defecto, ahora. */
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}
