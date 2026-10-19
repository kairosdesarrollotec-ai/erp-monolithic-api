import { ReservationExceedsGuaranteeError } from './reservation-errors';

/**
 * F-01 / DEC-RES-GUARANTEE-CAP-001: la reserva nunca supera la garantia del
 * vehiculo (`Vehicle.depositMinimum`, Flota). Si el vehiculo no tiene garantia
 * definida (null/ausente) no hay tope que validar. Compara en centimos para
 * evitar errores de coma flotante. Lanza 422 RESERVATION_EXCEEDS_GUARANTEE.
 */
export function assertReservationWithinGuarantee(
  requiredPaymentAmount: string,
  depositMinimum: number | string | null | undefined,
): void {
  if (depositMinimum == null) return;
  const amountCents = Math.round(Number(requiredPaymentAmount) * 100);
  const guaranteeCents = Math.round(Number(depositMinimum) * 100);
  if (amountCents > guaranteeCents) {
    throw new ReservationExceedsGuaranteeError(requiredPaymentAmount, (guaranteeCents / 100).toFixed(2));
  }
}
