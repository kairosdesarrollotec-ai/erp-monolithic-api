import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
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

  /** Inicio (inclusive) de la ventana de disponibilidad. ISO 8601 date o date-time. Requiere availableTo. */
  @IsOptional()
  @IsISO8601({ strict: true })
  availableFrom?: string;

  /** Fin (exclusivo) de la ventana de disponibilidad. ISO 8601 date o date-time. Requiere availableFrom. */
  @IsOptional()
  @IsISO8601({ strict: true })
  availableTo?: string;
}
