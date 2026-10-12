import { IsUUID, IsNumber, Min, IsString, MinLength, MaxLength } from 'class-validator';

export class CloseFinancialDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsNumber()
  @Min(0)
  retainedAmount!: number;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  notes!: string;
}
