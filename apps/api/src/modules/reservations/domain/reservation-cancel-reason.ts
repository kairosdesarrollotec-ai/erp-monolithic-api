import { InvalidReservationCancelReasonError } from './reservation-errors';

/**
 * DEC-RES-CANCEL-001 (Gerencia, 2026-10-15): una reserva solo se cancela por
 * razones del flujo documentado (BDD-RES-001), nunca por texto libre:
 *
 * - CUSTOMER_REQUESTED_CHANGE: el cliente cambia fecha/hora/vehiculo
 *   (BR-RES-003, DT-RES-03: no hay reprogramacion; el monto se PIERDE).
 * - NO_SHOW: el cliente no se presento (solo Gerencia; el monto se pierde).
 *
 * La tercera razon, venta del vehiculo (VEHICLE_SOLD_REFUND, con reembolso),
 * NO entra por `cancel`: solo la produce `resolve-sale` REJECT (BR-RES-007).
 */
export const RESERVATION_CANCEL_REASONS = ['CUSTOMER_REQUESTED_CHANGE', 'NO_SHOW'] as const;
export type ReservationCancelReason = (typeof RESERVATION_CANCEL_REASONS)[number];

export function isReservationCancelReason(value: unknown): value is ReservationCancelReason {
  return typeof value === 'string' && (RESERVATION_CANCEL_REASONS as readonly string[]).includes(value);
}

/** Defensa en profundidad para llamadas que no pasan por el DTO. */
export function assertReservationCancelReason(value: unknown): asserts value is ReservationCancelReason {
  if (!isReservationCancelReason(value)) {
    throw new InvalidReservationCancelReasonError(RESERVATION_CANCEL_REASONS);
  }
}
