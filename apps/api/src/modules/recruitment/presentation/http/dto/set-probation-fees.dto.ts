import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class SetProbationFeesDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  probationMonthlyFee!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  postProbationMonthlySalary?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  probationFeeNotes?: string;
}
