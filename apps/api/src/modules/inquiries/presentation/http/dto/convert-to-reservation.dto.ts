import { IsIn, IsISO8601, IsUUID } from 'class-validator';

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
}
