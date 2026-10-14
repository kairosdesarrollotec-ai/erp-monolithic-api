/**
 * TDD-RES-001.md seccion 8.1 - 5 estados reales (corregido 31 ago 2026:
 * no existe PENDING_PAYMENT ni EXPIRED, no hay bloqueo provisional).
 */
export type ReservationStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PENDING_SALE_RESOLUTION'
  | 'CONVERTED'
  | 'CANCELLED';

/**
 * Hallazgo alto de revision PR#6 ("maquina de estados incompleta"):
 * ninguno de los 5 handlers de comando verificaba el estado actual de la
 * reserva antes de actuar (registrar pago/documentos no exigian DRAFT,
 * cancelar no restringia estados de origen). Se agregan aqui las
 * precondiciones minimas que SI estan inequivocamente respaldadas por el
 * TDD/BDD sin inventar una matriz de transicion completa:
 *
 * - CANCELLED y CONVERTED son terminales por definicion (TDD-RES-001.md
 *   seccion 8.1 los describe como estados finales) - ninguna operacion
 *   de este modulo puede actuar sobre una reserva en esos 2 estados.
 * - Registrar pago/documentos y confirmar solo tienen sentido mientras
 *   la reserva sigue en DRAFT (RES-P09/P10/P11 del BDD describen estos
 *   pasos como parte del armado de la reserva, antes de CONFIRMED).
 *
 * PENDING_SALE_RESOLUTION (vehiculo vendido, UC-RES-004) no es terminal pero
 * tampoco admite los comandos normales: solo `resolve-sale` lo resuelve
 * (CancelReservationHandler lo rechaza con RESERVATION_STATE_CONFLICT; ver
 * DEC-RES-SALE-001 en docs/decision-log.md).
 */
export const TERMINAL_RESERVATION_STATUSES: ReadonlySet<ReservationStatus> = new Set([
  'CANCELLED',
  'CONVERTED',
]);

export function isTerminalReservationStatus(status: ReservationStatus): boolean {
  return TERMINAL_RESERVATION_STATUSES.has(status);
}
