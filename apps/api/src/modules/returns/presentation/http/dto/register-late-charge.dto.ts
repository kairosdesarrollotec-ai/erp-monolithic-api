import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

/** DEC-DEV-LATE-CHARGE-002: monto MANUAL (sin cálculo automático) digitado por un usuario autorizado. */
export class RegisterReturnLateChargeDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
