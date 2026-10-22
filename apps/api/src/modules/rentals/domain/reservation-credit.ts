import { DomainUnprocessableError } from '../../../common/domain/domain-errors';
import { ReservationCreditExceedsGuaranteeError } from './rental-errors';

/**
 * BR-ALQ-020 (BDD-KAIROS-MVP-002-ALQ v1.8, aprobado 2026-10-13):
 * el monto pagado por la reserva se TRASLADA INTEGRO a la garantia del
 * alquiler y la garantia se completa cobrando solo la diferencia. Aplica
 * unicamente a alquileres de origen Reserva; en alquiler directo (sin
 * reserva) se cobra la garantia completa.
 *
 * Funciones puras: la regla vive aqui para que el handler y la lectura
 * (vista previa en ENTREGA-03) usen exactamente el mismo calculo.
 */

/** Datos minimos de la reserva de origen que Alquiler necesita para decidir el traslado. */
export interface ReservationCreditSource {
  reservationId: string;
  status: string;
  /** requiredPaymentAmount de la reserva (monto vigente cuando se pacto). */
  amount: string;
  currency: string;
  /** null = el pago de la reserva nunca se valido. */
  paymentValidatedAt: Date | null;
}

export type ReservationCreditReason =
  | 'APPLIED'
  | 'NO_RESERVATION'
  | 'RESERVATION_NOT_ACTIVE'
  | 'PAYMENT_NOT_VALIDATED';

export interface ReservationCreditResolution {
  /** true si el monto de la reserva se traslada a la garantia. */
  applicable: boolean;
  reason: ReservationCreditReason;
  reservationId: string | null;
  /** Monto a trasladar, "0.00" si no aplica. */
  amount: string;
  currency: string | null;
}

/**
 * Estados de reserva desde los que el monto se traslada. Una reserva
 * CANCELLED (incluye la cancelacion por no-show) NO traslada nada; DRAFT y
 * PENDING_SALE_RESOLUTION tampoco son origen valido de un alquiler.
 */
const CREDIT_ELIGIBLE_RESERVATION_STATUSES: ReadonlySet<string> = new Set(['CONFIRMED', 'CONVERTED']);

export function toCents(amount: string | number): number {
  return Math.round(Number(amount) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function resolveReservationCredit(source: ReservationCreditSource | null): ReservationCreditResolution {
  if (!source) {
    return { applicable: false, reason: 'NO_RESERVATION', reservationId: null, amount: '0.00', currency: null };
  }
  const base = { reservationId: source.reservationId, currency: source.currency };
  if (!CREDIT_ELIGIBLE_RESERVATION_STATUSES.has(source.status)) {
    return { ...base, applicable: false, reason: 'RESERVATION_NOT_ACTIVE', amount: '0.00' };
  }
  if (!source.paymentValidatedAt || toCents(source.amount) <= 0) {
    return { ...base, applicable: false, reason: 'PAYMENT_NOT_VALIDATED', amount: '0.00' };
  }
  return { ...base, applicable: true, reason: 'APPLIED', amount: fromCents(toCents(source.amount)) };
}

export interface DepositBreakdown {
  /** Garantia total del alquiler (lo que queda retenido). */
  totalAmount: string;
  /** Parte del monto de la reserva que cubre la garantia (<= totalAmount). */
  reservationCreditAmount: string;
  /**
   * DEPRECADO (Russbel 22-oct-2026, decision 2): ya no se genera excedente ni saldo a favor (el monto de la reserva
   * nunca supera la garantia, F-01 / DEC-RES-GUARANTEE-CAP-001). Siempre "0.00"; la columna se conserva sin uso.
   * DEC-ALQ-RESCREDIT-002 queda superada.
   */
  reservationCreditExcess: string;
  /** Diferencia que se cobra al formalizar. */
  amountToCollect: string;
  currency: string;
}

export class ReservationCreditCurrencyMismatchError extends DomainUnprocessableError {
  readonly code = 'RESERVATION_CREDIT_CURRENCY_MISMATCH';

  constructor(reservationCurrency: string, depositCurrency: string) {
    super(
      `La reserva se pago en ${reservationCurrency} y la garantia se registra en ${depositCurrency}. ` +
        'Registre la garantia en la misma moneda de la reserva.',
    );
  }
}

/**
 * Calcula el desglose de la garantia. Lanza si la moneda difiere.
 *
 * Russbel 22-oct-2026 (decision 2; Catalogo G-01/F-01, SDD-RES-001 v2.2 UC-RES-005): el monto de la reserva se traslada
 * INTEGRO a la garantia y se cobra solo la diferencia; NO hay saldo a favor. Validacion defensiva: si el monto de la
 * reserva supera la garantia del alquiler -> 422 RESERVATION_EXCEEDS_GUARANTEE (la reserva ya no puede superar la
 * garantia del vehiculo, asi que solo ocurriria por datos antiguos o por cambio de la tarifa de Flota).
 */
export function computeDepositBreakdown(
  totalAmount: string,
  currency: string,
  credit: ReservationCreditResolution,
): DepositBreakdown {
  const totalCents = toCents(totalAmount);
  if (!credit.applicable) {
    return {
      totalAmount: fromCents(totalCents),
      reservationCreditAmount: '0.00',
      reservationCreditExcess: '0.00',
      amountToCollect: fromCents(totalCents),
      currency,
    };
  }
  if (credit.currency !== currency) {
    throw new ReservationCreditCurrencyMismatchError(credit.currency ?? '?', currency);
  }
  const creditCents = toCents(credit.amount);
  if (creditCents > totalCents) {
    throw new ReservationCreditExceedsGuaranteeError(fromCents(creditCents), fromCents(totalCents));
  }
  return {
    totalAmount: fromCents(totalCents),
    reservationCreditAmount: fromCents(creditCents),
    reservationCreditExcess: '0.00',
    amountToCollect: fromCents(totalCents - creditCents),
    currency,
  };
}

/**
 * DEC-ALQ-COMPANY-DRIVER-004: con conductor de la empresa NO hay garantia (Ficha AS-IS 5-ago: se omite el proceso de
 * garantia; la responsabilidad recae en el conductor). Russbel 22-oct-2026 (decision 2): ya NO se escribe saldo a favor
 * (`reservationCreditExcess` queda en "0.00"). Si el alquiler viene de una reserva con pago validado, el monto no tiene
 * garantia a la cual aplicarse: se informa en `unappliedReservationAmount` (solo auditoria/outbox) para que Finanzas lo
 * resuelva fuera del sistema (pregunta abierta, PROPUESTO).
 */
export interface NoDepositBreakdown {
  reservationCreditExcess: string;
  /** Monto de reserva pagado que no se aplico a ninguna garantia ("0.00" si no hay). */
  unappliedReservationAmount: string;
  currency: string | null;
}

export function computeNoDepositBreakdown(credit: ReservationCreditResolution): NoDepositBreakdown {
  if (!credit.applicable) return { reservationCreditExcess: '0.00', unappliedReservationAmount: '0.00', currency: null };
  return {
    reservationCreditExcess: '0.00',
    unappliedReservationAmount: fromCents(toCents(credit.amount)),
    currency: credit.currency,
  };
}
