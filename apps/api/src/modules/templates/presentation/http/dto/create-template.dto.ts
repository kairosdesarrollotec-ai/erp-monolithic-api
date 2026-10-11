import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TEMPLATE_TYPES } from '../../../domain/template-type';

export class CreateTemplateDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsIn(TEMPLATE_TYPES)
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}
