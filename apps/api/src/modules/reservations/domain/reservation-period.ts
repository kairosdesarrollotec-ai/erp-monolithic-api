import { InvalidReservationPeriodError } from './reservation-errors';

/**
 * RES PEND-13 / ERR-07 - el periodo de una reserva debe ser un intervalo no vacio: `startAt < endAt`.
 * 400 INVALID_PERIOD (antes no se validaba de forma explicita; en el flujo desde Consulta `endAt` se calcula
 * como `startAt + estimatedDays`, asi que solo falla ante datos corruptos de la cotizacion).
 */
export function assertValidReservationPeriod(startAt: Date, endAt: Date): void {
  if (!(startAt.getTime() < endAt.getTime())) {
    throw new InvalidReservationPeriodError();
  }
}
