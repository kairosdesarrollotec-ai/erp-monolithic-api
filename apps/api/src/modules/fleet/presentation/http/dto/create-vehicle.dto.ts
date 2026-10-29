import { Type } from 'class-transformer';
import {
  IsBoolean,
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

  @IsOptional()
  @IsBoolean()
  suitableForTrocha?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rateNormal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ratePlus?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rateLibre?: number;

  /**
   * Decisión de negocio 28-oct #1 (H-06): todo vehículo nuevo debe traer el precio por línea de combustible faltante (línea del
   * RNC, Formato 06). La multa de la devolución = líneas faltantes entre entrega y devolución x este precio.
   */
  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'fuelPenaltyPerLine es obligatorio y debe ser mayor a 0.' })
  fuelPenaltyPerLine!: number;
}
