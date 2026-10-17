import type { ReturnStatus } from './return-status';

/**
 * BR-DEV-003 / BR-DEV-004 (CONFIRMADO por el usuario, 2026-10-15): tolerancia de devolución SIN sanción de 30 minutos
 * sobre la hora pactada. Devolver hasta 30 min tarde NO cuenta como retraso. Fuente única de la constante: el texto
 * del recordatorio (BR-DEV-004) y el cálculo de retraso (BR-DEV-003) la comparten.
 *
 * Alcance: los documentos NO definen ningún cargo por retraso ni su tarifa; por eso la tolerancia solo gobierna el
 * indicador `isLate` (informativo para el front). No dispara cobros ni bloqueos.
 */
export const RETURN_LATE_TOLERANCE_MINUTES = 30;
export const RETURN_LATE_TOLERANCE_MS = RETURN_LATE_TOLERANCE_MINUTES * 60 * 1000;

export interface LatenessSubject {
  status: ReturnStatus;
  scheduledAt: Date;
  receivedAt: Date | null;
}

export interface ReturnLateness {
  lateToleranceMinutes: number;
  /** Minutos enteros transcurridos después de la hora pactada hasta la referencia (0 si no hay retraso bruto). */
  lateMinutes: number;
  /** true solo si el retraso supera estrictamente la tolerancia. */
  isLate: boolean;
  /** RECEIVED = medido contra la recepción real (definitivo); NOW = vehículo aún no recibido (parcial, crece con el reloj). */
  basis: 'RECEIVED' | 'NOW';
}

/** Devuelve null para devoluciones CANCELADA sin recepción (no aplica). */
export function computeReturnLateness(subject: LatenessSubject, now: Date): ReturnLateness | null {
  if (!subject.receivedAt && subject.status === 'CANCELADA') return null;
  const reference = subject.receivedAt ?? now;
  const deltaMs = reference.getTime() - subject.scheduledAt.getTime();
  return {
    lateToleranceMinutes: RETURN_LATE_TOLERANCE_MINUTES,
    lateMinutes: deltaMs > 0 ? Math.floor(deltaMs / 60000) : 0,
    isLate: deltaMs > RETURN_LATE_TOLERANCE_MS,
    basis: subject.receivedAt ? 'RECEIVED' : 'NOW',
  };
}

/**
 * DEC-DEV-LATE-CHARGE-001 - Hoja de Políticas VR-GA-PA-VS.04 (26.03.2026), CONFIRMADA por el usuario.
 * Cargo SUGERIDO por retraso (informativo: el cobro sigue siendo manual; nunca bloquea ni cobra solo).
 *
 * Tiempo adicional (31 min - 120 min = 25% del día; 121 min - 5 h = 50%; > 5 h = día completo).
 * Penalidad sobre la GARANTÍA si no avisó / no pagó antes: 20% (31-120), 30% (121-300), 50% (> 300 min).
 * Retraso no autorizado > 12 h = incumplimiento grave (facultad de Gerencia).
 */
export type LatenessTier = 'NONE' | 'EXTRA_31_120' | 'EXTRA_121_300' | 'EXTRA_OVER_300';

export const LATENESS_TIER_BOUNDS_MINUTES = { tier1Max: 120, tier2Max: 300, severeBreach: 720 } as const;

export const LATENESS_TIER_RULES: Record<LatenessTier, { timeChargePercent: number; guaranteePenaltyPercent: number }> = {
  NONE: { timeChargePercent: 0, guaranteePenaltyPercent: 0 },
  EXTRA_31_120: { timeChargePercent: 25, guaranteePenaltyPercent: 20 },
  EXTRA_121_300: { timeChargePercent: 50, guaranteePenaltyPercent: 30 },
  EXTRA_OVER_300: { timeChargePercent: 100, guaranteePenaltyPercent: 50 },
};

/** Tramo según el retraso EXACTO en ms (30:00 no es retraso; 120:00 aún es el primer tramo; 720:00 aún no es grave). */
export function latenessTierForDelta(deltaMs: number): LatenessTier {
  const minute = 60000;
  if (deltaMs <= RETURN_LATE_TOLERANCE_MS) return 'NONE';
  if (deltaMs <= LATENESS_TIER_BOUNDS_MINUTES.tier1Max * minute) return 'EXTRA_31_120';
  if (deltaMs <= LATENESS_TIER_BOUNDS_MINUTES.tier2Max * minute) return 'EXTRA_121_300';
  return 'EXTRA_OVER_300';
}

export function isSevereLateness(deltaMs: number): boolean {
  return deltaMs > LATENESS_TIER_BOUNDS_MINUTES.severeBreach * 60000;
}

export interface LatenessExtensionInfo {
  status: string;
  requestedEndAt: Date;
  paymentId: string | null;
}

export interface LatenessChargeInputs {
  /** Tarifa diaria vigente del vehículo (misma fuente que el cargo de paralización); null si no tiene. */
  dailyRate: number | null;
  /** Garantía del alquiler (rental_deposits.original_amount); null/ausente = sin garantía (p. ej. con conductor de la empresa). */
  deposit?: { originalAmount: number; currency: string } | null;
  /** Ampliaciones del alquiler; undefined/null = no disponibles (no se puede determinar el aviso/pago previo). */
  extensions?: LatenessExtensionInfo[] | null;
}

export interface ReturnLatenessCharge {
  tier: LatenessTier;
  basis: 'RECEIVED' | 'NOW';
  /** Siempre true: es una sugerencia; el cobro es manual (deposit adjustments / charge-immobilization). */
  informational: true;
  timeChargePercent: number;
  guaranteePenaltyPercent: number;
  /** Tarifa diaria usada (decimal string) o null si el vehículo no tiene tarifa. */
  dailyRate: string | null;
  /** Garantía del alquiler (decimal string) o null si no hay garantía. */
  guaranteeAmount: string | null;
  currency: string | null;
  /** timeChargePercent x tarifa diaria. null si tramo NONE o sin tarifa. */
  suggestedTimeCharge: string | null;
  /** guaranteePenaltyPercent x garantía. null si tramo NONE, sin garantía, o si el aviso+pago previo está verificado (true). Si false/null: "si no avisó/pagó antes". */
  suggestedGuaranteePenalty: string | null;
  /** true solo con una ampliación AUTORIZADA y pagada que cubre el tiempo; false sin ampliación que lo cubra; null = no determinable, lo confirma el operador. */
  noticeAndPrepaymentVerified: boolean | null;
  /** Retraso no autorizado > 12 h: incumplimiento grave (retener garantía / resolver contrato = decisión de Gerencia). */
  severeBreach: boolean;
  severeBreachThresholdHours: number;
}

function percentOfCents(cents: number, percent: number): string {
  const result = Math.floor((cents * percent + 50) / 100);
  return (result / 100).toFixed(2);
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function verifyNotice(
  extensions: LatenessExtensionInfo[] | null | undefined,
  reference: Date,
): boolean | null {
  if (!extensions) return null;
  const covering = extensions.filter((e) => e.status === 'AUTHORIZED' && e.requestedEndAt.getTime() >= reference.getTime());
  if (covering.some((e) => e.paymentId)) return true;
  if (covering.length > 0) return null; // autorizada pero sin pago ligado: que lo confirme el operador
  return false;
}

/** null si la devolución no tiene retraso aplicable (CANCELADA sin recepción). */
export function computeReturnLatenessCharge(
  subject: LatenessSubject,
  now: Date,
  inputs: LatenessChargeInputs,
): ReturnLatenessCharge | null {
  if (!subject.receivedAt && subject.status === 'CANCELADA') return null;
  const reference = subject.receivedAt ?? now;
  const deltaMs = reference.getTime() - subject.scheduledAt.getTime();
  const tier = latenessTierForDelta(deltaMs);
  const rules = LATENESS_TIER_RULES[tier];
  const rate = inputs.dailyRate !== null && inputs.dailyRate > 0 ? toCents(inputs.dailyRate) : null;
  const guarantee = inputs.deposit && inputs.deposit.originalAmount > 0 ? toCents(inputs.deposit.originalAmount) : null;
  const verified = tier === 'NONE' ? null : verifyNotice(inputs.extensions, reference);
  const late = tier !== 'NONE';
  return {
    tier,
    basis: subject.receivedAt ? 'RECEIVED' : 'NOW',
    informational: true,
    timeChargePercent: rules.timeChargePercent,
    guaranteePenaltyPercent: rules.guaranteePenaltyPercent,
    dailyRate: rate === null ? null : (rate / 100).toFixed(2),
    guaranteeAmount: guarantee === null ? null : (guarantee / 100).toFixed(2),
    currency: guarantee === null ? null : inputs.deposit!.currency,
    suggestedTimeCharge: late && rate !== null ? percentOfCents(rate, rules.timeChargePercent) : null,
    suggestedGuaranteePenalty:
      late && guarantee !== null && verified !== true ? percentOfCents(guarantee, rules.guaranteePenaltyPercent) : null,
    noticeAndPrepaymentVerified: verified,
    severeBreach: isSevereLateness(deltaMs),
    severeBreachThresholdHours: LATENESS_TIER_BOUNDS_MINUTES.severeBreach / 60,
  };
}
