import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** UC-RES-004 / RES-07 - Gerencia/Administrador registra la venta del vehiculo reservado. */
export class FlagVehicleSaleDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Vehiculo alternativo que se ofrece al cliente (RES-P14). Opcional: puede ofrecerse al resolver. */
  @IsOptional() @IsUUID() alternativeVehicleId?: string;

  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
