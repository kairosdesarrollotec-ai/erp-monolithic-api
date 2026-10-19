import { IsString, IsUUID, Matches } from 'class-validator';

/** DEC-ALQ-DRIVERRATE-001: tarifa diaria manual del conductor de la empresa (PEN). */
export class SetCompanyDriverDailyRateDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Monto por dia en PEN: > 0, hasta 2 decimales (DECIMAL(10,2)). Ej. "120" o "120.50". */
  @IsString()
  @Matches(/^(?!0+(\.0{1,2})?$)\d{1,8}(\.\d{1,2})?$/, {
    message: 'dailyRate debe ser un monto mayor que 0 con un maximo de 2 decimales',
  })
  dailyRate!: string;
}
