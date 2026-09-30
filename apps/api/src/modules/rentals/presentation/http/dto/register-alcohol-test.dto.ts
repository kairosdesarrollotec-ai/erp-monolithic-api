import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { AlcoholTestResult } from '../../../domain/alcohol-test-result';

export class RegisterAlcoholTestDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(['FAVORABLE', 'DESFAVORABLE', 'RECHAZADO'])
  result!: AlcoholTestResult;

  @IsOptional()
  @IsString()
  notes?: string;
}
