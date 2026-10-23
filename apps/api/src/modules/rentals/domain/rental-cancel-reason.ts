import { RentalCancelReasonInvalidError } from './rental-errors';

/**
 * DEC-ALQ-CANCEL-001 (Russbel 22-oct-2026): motivos de cancelacion manual de un alquiler antes de la entrega.
 * La cancelacion por alcolimetro desfavorable (BR-ALQ-005) sigue su propio camino (register-alcohol-test).
 */
export const RENTAL_CANCEL_REASONS = ['DOCUMENTS_INVALID', 'CUSTOMER_REJECTED_NOTARY', 'OTHER'] as const;
export type RentalCancelReason = (typeof RENTAL_CANCEL_REASONS)[number];

export const OTHER_REASON_MIN_NOTE_LENGTH = 10;

export function assertRentalCancelReason(reason: string, note: string | undefined): asserts reason is RentalCancelReason {
  if (!(RENTAL_CANCEL_REASONS as readonly string[]).includes(reason)) {
    throw new RentalCancelReasonInvalidError(RENTAL_CANCEL_REASONS);
  }
  if (reason === 'OTHER' && (note ?? '').trim().length < OTHER_REASON_MIN_NOTE_LENGTH) {
    throw new RentalCancelReasonInvalidError(RENTAL_CANCEL_REASONS);
  }
}
