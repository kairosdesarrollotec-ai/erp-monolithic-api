import { IsString, IsNumber, IsPositive, IsInt, Min, IsDateString, Length } from 'class-validator';

export class CreateRateCardDto {
  @IsString()
  companyId!: string;

  @IsString()
  branchId!: string;

  @IsNumber()
  @IsPositive()
  amountPerDay!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsInt()
  @Min(1)
  validityHours!: number;

  @IsDateString()
  effectiveFrom!: string;
}
