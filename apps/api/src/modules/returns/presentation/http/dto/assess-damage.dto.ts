import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { COSMETIC_ZONE_CODES, normalizeZoneCode } from '../../../domain/cosmetic-damage-rate';
import { DAMAGE_ORIGINS, DAMAGE_SEVERITIES, DamageOrigin, DamageSeverity } from '../../../domain/return-status';

export class AssessDamageDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(DAMAGE_ORIGINS)
  origin!: DamageOrigin;

  @IsIn(DAMAGE_SEVERITIES)
  severity!: DamageSeverity;

  /** Código del tarifario (GET /returns/cosmetic-tariff); el backend normaliza mayúsculas/guiones. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeZoneCode(value) : value))
  @IsString()
  @IsIn(COSMETIC_ZONE_CODES)
  damagedZone?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalReportReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** BR-DEV-007: el cliente acepta el costo del daño leve/moderado -> semáforo AMBAR. */
  @IsOptional()
  @IsBoolean()
  customerAcceptsCost?: boolean;
}
