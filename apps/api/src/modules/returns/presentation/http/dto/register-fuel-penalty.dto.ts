import { IsNumber, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class RegisterFuelPenaltyDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

