import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SALE_DECISIONS, type SaleDecision } from '../../../domain/reservation-sale-resolution';

/** UC-RES-004 / RES-07 - decision del cliente ante la venta de su vehiculo reservado. */
export class ResolveVehicleSaleDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(SALE_DECISIONS as unknown as string[])
  decision!: SaleDecision;

  /** Con ACCEPT_ALTERNATIVE: vehiculo elegido; si se omite se usa el ofrecido al registrar la venta. */
  @IsOptional() @IsUUID() alternativeVehicleId?: string;

  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
