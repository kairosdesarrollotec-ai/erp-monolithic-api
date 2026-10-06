import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { RETURN_FUEL_LEVELS, ReturnFuelLevel } from '../../../domain/return-status';

export class ReceiveProvisionalDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsUUID() rentalId!: string;

  @IsInt()
  @Min(0)
  mileageAtReturn!: number;

  @IsIn(RETURN_FUEL_LEVELS)
  fuelLevelAtReturn!: ReturnFuelLevel;

  @IsOptional()
  @IsBoolean()
  customerPresent?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
