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
  @IsNumber({}, { message: 'depositMinimum (garantia) debe ser un numero' })
  @Min(0, { message: 'depositMinimum (garantia) debe ser mayor o igual a 0' })
  depositMinimum?: number;

  /**
   * Obligatoria en el alta (G-05, DEC-FLT-CAP-001). La ausencia/`null` se rechaza en el handler con el codigo
   * de dominio 400 PASSENGER_CAPACITY_REQUIRED (el ValidationPipe global solo daria un mensaje generico);
   * aqui solo se valida el rango cuando viene informada.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'passengerCapacity debe ser un entero' })
  @Min(1, { message: 'passengerCapacity debe ser al menos 1' })
  @Max(60, { message: 'passengerCapacity no puede superar 60' })
  passengerCapacity?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'fuelPrice (precio del combustible) debe ser un numero' })
  @Min(0, { message: 'fuelPrice (precio del combustible) debe ser mayor o igual a 0' })
  fuelPrice?: number;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_tld: true })
  @Matches(/^https:\/\/storage\.googleapis\.com\//, {
    message: 'photoUrl must be a Google Cloud Storage HTTPS URL',
  })
  photoUrl?: string;
}
