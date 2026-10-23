import { ChannelMode, CustomerLocation } from '../../../reservations/domain/channel-mode';

/**
 * Hallazgo critico de revision PR#7 ("convertir no crea reserva"):
 * `channelMode`/`startAt` no existian en este comando porque la
 * Reservation la creaba el frontend en un segundo paso separado. Ahora
 * que este comando crea la Reservation atomicamente (ver
 * ConvertToReservationHandler), necesita estos 2 datos que ninguna
 * fuente existente provee: `Inquiry`/`Quotation` no capturan modalidad
 * de exhibicion ni fecha de inicio concreta (`Quotation.estimatedDays`
 * es una DURACION relativa, no un rango de fechas - ver
 * docs/decision-log.md NOTA-PR7). El resto de los datos de la Reservation
 * (vehicleId/monto/moneda) se toman de la ultima Quotation vigente de la
 * consulta, nunca del payload.
 */
export class ConvertToReservationCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly channelMode: ChannelMode,
    public readonly startAt: Date,
    /** PEND-08 (opcional): si es false, la modalidad PRESENCIAL se rechaza. */
    public readonly canComeToOffice?: boolean,
    public readonly customerLocation?: CustomerLocation,
  ) {}
}
