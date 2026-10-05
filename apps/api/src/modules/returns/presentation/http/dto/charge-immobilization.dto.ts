import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

/** La tarifa diaria NO viene del cliente: se toma del dailyRate vigente del vehículo (TDD §9.3). */
export class ChargeImmobilizationDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsUUID()
  damageId?: string;

  @IsInt()
  @Min(1)
  daysCharged!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
