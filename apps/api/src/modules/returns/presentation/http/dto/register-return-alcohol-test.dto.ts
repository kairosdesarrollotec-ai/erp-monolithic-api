import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ALCOHOL_TEST_RESULTS, AlcoholTestResult } from '../../../domain/return-status';

export class RegisterReturnAlcoholTestDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(ALCOHOL_TEST_RESULTS)
  result!: AlcoholTestResult;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
