import { IsUUID } from 'class-validator';

/** RES-06 "Continuar -> RES-04 con alternativa elegida" - cambia el vehiculo de una reserva en DRAFT. */
export class ChangeReservationVehicleDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsUUID() vehicleId!: string;
}
