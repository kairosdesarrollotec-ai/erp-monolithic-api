import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { VehicleStatus } from '../../../domain/vehicle';

export class CreateVehicleDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsUUID()
  assignedBranchId?: string;

  @IsString()
  @IsNotEmpty()
  plate!: string;

  @IsString()
  @IsNotEmpty()
  brand!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['AVAILABLE', 'RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE'])
  status?: VehicleStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositMinimum?: number;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_tld: true })
  @Matches(/^https:\/\/storage\.googleapis\.com\//, {
    message: 'photoUrl must be a Google Cloud Storage HTTPS URL',
  })
  photoUrl?: string;
}
