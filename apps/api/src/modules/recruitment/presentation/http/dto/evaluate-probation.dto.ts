import { IsBoolean, IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';

export class EvaluateProbationDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsBoolean()
  passed!: boolean;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  qualitativeEvaluation!: string;
}
