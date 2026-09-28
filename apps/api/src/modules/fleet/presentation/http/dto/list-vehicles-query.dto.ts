import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { VehicleStatus } from '../../../domain/vehicle';

export class ListVehiclesQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsUUID()
  filterBranchId?: string;

  @IsOptional()
  @IsIn(['AVAILABLE', 'RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE'])
  status?: VehicleStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
