import { DomainUnprocessableError } from '../../../common/domain/domain-errors';

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
  /** Monto de la reserva trasladado a la garantia. */
  reservationCreditAmount: string;
  /** Diferencia que se cobra al formalizar. */
  amountToCollect: string;
  currency: string;
}

export class ReservationCreditExceedsDepositError extends DomainUnprocessableError {
  readonly code = 'RESERVATION_CREDIT_EXCEEDS_DEPOSIT';

  constructor(credit: string, total: string, currency: string) {
    super(
      `El monto pagado en la reserva (${currency} ${credit}) supera la garantia indicada (${currency} ${total}). ` +
        'Revise el monto de garantia: el excedente no se devuelve ni se traslada automaticamente.',
    );
  }
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
 * Calcula el desglose de la garantia. Lanza si el traslado es inconsistente
 * (moneda distinta o monto de reserva mayor que la garantia): nunca se
 * ignora ni se recorta en silencio un monto ya cobrado al cliente.
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
      amountToCollect: fromCents(totalCents),
      currency,
    };
  }
  if (credit.currency !== currency) {
    throw new ReservationCreditCurrencyMismatchError(credit.currency ?? '?', currency);
  }
  const creditCents = toCents(credit.amount);
  if (creditCents > totalCents) {
    throw new ReservationCreditExceedsDepositError(credit.amount, fromCents(totalCents), currency);
  }
  return {
    totalAmount: fromCents(totalCents),
    reservationCreditAmount: fromCents(creditCents),
    amountToCollect: fromCents(totalCents - creditCents),
    currency,
  };
}
