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

  /**
   * OBLIGATORIO en el contrato (HU-03). En el DTO se declaran opcionales a propósito:
   * su ausencia debe responder 422 RETURN_IDENTITY_REQUIRED desde el dominio (no 400).
   */
  @IsOptional()
  @IsBoolean()
  identityVerified?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  identityDocumentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  identityDocumentNumber?: string;

  @IsOptional()
  @IsBoolean()
  identityMatchesHolder?: boolean;

  @IsOptional()
  @IsIn(['CONFORME', 'NO_CONFORME'])
  identityResult?: 'CONFORME' | 'NO_CONFORME';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observation?: string;
}
