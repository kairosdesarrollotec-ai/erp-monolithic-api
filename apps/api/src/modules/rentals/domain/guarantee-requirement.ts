import type { NotaryResult } from './notary-result';
import { fromCents, toCents } from './reservation-credit';

/**
 * Russbel 22-oct-2026 (matriz notarial BDD-ALQ-001 10.1): la garantia exigida sale de la tarifa de Flota
 * (`Vehicle.depositMinimum`) y se DUPLICA cuando la evaluacion notarial dio DOUBLE_DEPOSIT. La tercera via
 * (THIRD_PATH_ELIGIBLE) NO duplica la garantia (BR-ALQ-004); MANDATORY (tramite notarial) y MANUAL_REVIEW aprobado por
 * Gerencia usan la garantia base (x1; MANUAL_REVIEW x1 es PROPUESTO).
 */
export function depositMultiplierFor(result: NotaryResult | null | undefined): 1 | 2 {
  return result === 'DOUBLE_DEPOSIT' ? 2 : 1;
}

export interface RequiredGuarantee {
  baseAmount: string;
  multiplier: 1 | 2;
  amount: string;
}

/** null si el vehiculo no tiene garantia definida en Flota (no hay tope que validar). */
export function requiredGuarantee(
  depositMinimum: number | string | null | undefined,
  result: NotaryResult | null | undefined,
): RequiredGuarantee | null {
  if (depositMinimum == null) return null;
  const baseCents = toCents(depositMinimum);
  const multiplier = depositMultiplierFor(result);
  return { baseAmount: fromCents(baseCents), multiplier, amount: fromCents(baseCents * multiplier) };
}
