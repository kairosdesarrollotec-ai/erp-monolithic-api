import { Type } from 'class-transformer';
import {
  IsBoolean,
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

export class UpdateVehicleDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsUUID()
  assignedBranchId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  brand?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  model?: string;

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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'depositMinimum (garantia) debe ser un numero' })
  @Min(0, { message: 'depositMinimum (garantia) debe ser mayor o igual a 0' })
  depositMinimum?: number;

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

  /**
   * DEC-ALQ-THIRDPATH-001: marca el vehiculo como "de menor costo relativo" elegible para la tercera via notarial.
   * Solo Gerencia (accion FLEET.MANAGE_THIRD_PATH, editable en ADM-02); otro rol recibe 403.
   */
  @IsOptional()
  @IsBoolean()
  thirdPathEligible?: boolean;

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fuelPenaltyPerLine?: number;
}
