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
  /** Parte del monto de la reserva que cubre la garantia (<= totalAmount). */
  reservationCreditAmount: string;
  /**
   * DEC-ALQ-RESCREDIT-002: excedente del monto de la reserva sobre la garantia
   * ("0.00" si no hay). Saldo a favor del cliente solo visible: sin reembolso
   * ni calculo automatico (pregunta abierta a Finanzas).
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
 * Calcula el desglose de la garantia. Lanza si la moneda difiere. Si el monto
 * de la reserva supera la garantia NO es error: se aplica hasta cubrirla y el
 * excedente se informa en `reservationCreditExcess` (nunca se pierde en
 * silencio).
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
  // El monto de la reserva es un acuerdo con el cliente: puede superar la
  // garantia (y los S/ 300 vigentes). Se aplica hasta cubrirla y el resto
  // queda como excedente visible, sin error.
  const appliedCents = Math.min(creditCents, totalCents);
  return {
    totalAmount: fromCents(totalCents),
    reservationCreditAmount: fromCents(appliedCents),
    reservationCreditExcess: fromCents(creditCents - appliedCents),
    amountToCollect: fromCents(totalCents - appliedCents),
    currency,
  };
}
