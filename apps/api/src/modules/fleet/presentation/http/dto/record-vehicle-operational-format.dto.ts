import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, IsNumber, Min } from 'class-validator';
import type { VehicleOperationalFormatType } from '../../../domain/vehicle-operational-format';

export class RecordVehicleOperationalFormatDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  formatType!: VehicleOperationalFormatType;

  @IsString()
  @IsOptional()
  processType?: string;

  @IsString()
  @IsOptional()
  processId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  odometerKm?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  fuelLevelLines?: number;

  @IsObject()
  @IsNotEmpty()
  data!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  observations?: string;

  @IsString()
  @IsNotEmpty()
  performedBy!: string;

  @IsString()
  @IsOptional()
  performedAt?: string;
}
