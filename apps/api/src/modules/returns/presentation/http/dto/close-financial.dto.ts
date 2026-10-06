import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CloseFinancialDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  refundAmount!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  retainedAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
