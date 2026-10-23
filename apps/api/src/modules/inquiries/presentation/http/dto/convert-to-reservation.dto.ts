import { IsBoolean, IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { CUSTOMER_LOCATIONS, CustomerLocation } from '../../../../reservations/domain/channel-mode';

/**
 * Hallazgo critico de revision PR#7 ("convertir no crea reserva"):
 * `channelMode`/`startAt` son nuevos - los necesita
 * `ConvertToReservationHandler` para crear la Reservation atomicamente
 * (ver el comentario en `ConvertToReservationCommand` para por que
 * ninguna fuente existente los provee).
 */
export class ConvertToReservationDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(['PRESENCIAL', 'VIRTUAL']) channelMode!: 'PRESENCIAL' | 'VIRTUAL';
  @IsISO8601() startAt!: string;

  /** PEND-08 (BR-RES-005): el cliente puede acercarse a la oficina. Opcional; si es false, PRESENCIAL se rechaza. */
  @IsOptional() @IsBoolean() canComeToOffice?: boolean;
  /** PEND-08 (DAT-RES-001): ubicacion del cliente. Opcional; FUERA_DE_AYACUCHO con PRESENCIAL se rechaza. */
  @IsOptional() @IsIn(CUSTOMER_LOCATIONS) customerLocation?: CustomerLocation;
}
