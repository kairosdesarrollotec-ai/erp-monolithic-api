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
 * PENDING_SALE_RESOLUTION queda deliberadamente fuera de estas guardas
 * (no se bloquea ni se permite de forma expresa): ese estado lo produce
 * el flujo de venta de vehiculo (RES-06/RES-07), fuera de alcance de
 * este primer corte de HU-27 (ver reservations.controller.ts), y ningun
 * documento fuente disponible aqui especifica si una reserva en ese
 * estado debe poder cancelarse desde este mismo comando o solo desde el
 * modulo de venta. Definir eso sin una fuente que lo respalde violaria
 * la politica de no inventar reglas de negocio (CLAUDE.md seccion 4) -
 * queda como pregunta abierta para quien tenga el BDD/SDD de venta de
 * vehiculo.
 */
export const TERMINAL_RESERVATION_STATUSES: ReadonlySet<ReservationStatus> = new Set([
  'CANCELLED',
  'CONVERTED',
]);

export function isTerminalReservationStatus(status: ReservationStatus): boolean {
  return TERMINAL_RESERVATION_STATUSES.has(status);
}
