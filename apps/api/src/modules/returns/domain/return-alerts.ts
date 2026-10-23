import { calculateImmobilizationCharge } from './damage-calculator';
import { roundMoney } from './return-rules';
import { computeReturnLateness, LATE_CHARGE_REGISTRABLE_STATUSES, RETURN_LATE_TOLERANCE_MINUTES } from './return-lateness';
import type { DamageOrigin, ReturnStatus } from './return-status';

/**
 * BR-DEV-001 / NFR-BIZ-003: la garantía de una devolución SIN daños se libera en un plazo MÁXIMO de 24 h naturales
 * desde la recepción. SC-DEV-001.02: al acercarse el límite sin liberar, el sistema alerta (solo alerta: nunca
 * ejecuta el reembolso, DEC-DEV-WARRANTY-ALERT-001).
 */
export const WARRANTY_RELEASE_WINDOW_HOURS = 24;
/** "Se acerca el límite": alerta DUE_SOON cuando faltan 4 h o menos. Decisión CONFIRMADA por el usuario (2026-10-15). */
export const WARRANTY_RELEASE_WARNING_LEAD_HOURS = 4;
/** BR-DEV-011: a partir de 24 h naturales de inmovilización corresponde cobro (manual). */
export const IMMOBILIZATION_ALERT_AFTER_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

export type WarrantyReleaseAlertLevel = 'DUE_SOON' | 'OVERDUE';

export interface WarrantyReleaseAlert {
  level: WarrantyReleaseAlertLevel;
  /** receivedAt + 24 h. */
  deadlineAt: Date;
  /** Horas que faltan para el límite (negativo cuando ya venció). */
  hoursRemaining: number;
}

export interface ImmobilizationAlert {
  /** Cierre de la devolución (inicio del reloj de paralización, BR-DEV-011 desde el 22-oct-2026; antes: la recepción). */
  since: Date;
  hoursElapsed: number;
  /** Días de paralización justificados por el reloj y aún sin cobrar. */
  pendingDays: number;
  dailyRate: number | null;
  /** pendingDays x dailyRate (null si el vehículo no tiene tarifa). Sugerencia: el cobro es manual. */
  suggestedAmount: number | null;
}

/**
 * DEC-DEVREM-003 / F-03 (Fiorella): el retraso pasada la tolerancia SÍ tiene cargo y se registra MANUALMENTE. El sistema solo
 * SUGIERE al usuario autorizado que lo registre: NO lleva monto (lo digita la persona) ni cobra nada.
 */
export interface LateChargeSuggestion {
  /** Minutos enteros de retraso real (recepción menos hora pactada). */
  lateMinutes: number;
  lateToleranceMinutes: number;
}

export interface ReturnAlerts {
  warrantyRelease: WarrantyReleaseAlert | null;
  immobilization: ImmobilizationAlert | null;
}

export interface AlertSubject {
  status: ReturnStatus;
  receivedAt: Date | null;
  /** Cierre de la devolución (CERRADA): arranca el reloj de paralización. null = reloj aún sin arrancar. */
  closedAt?: Date | null;
  vehicleDailyRate: number | null;
  /** false = sin garantia (conductor de la empresa): no hay garantia que liberar en 24 h. */
  depositRequired?: boolean;
  damages?: ReadonlyArray<{ origin: DamageOrigin }>;
  immobilizationCharges?: ReadonlyArray<{ daysCharged: number }>;
  /** Solo para la sugerencia de cargo por retraso. */
  scheduledAt?: Date;
  /** Cargo por retraso manual ya registrado (null/ausente = sin registrar). */
  lateChargeAmount?: number | null;
}

/**
 * Garantía por liberar: devolución SIN_DANOS (inspección sin daños) aún sin cierre financiero. Un daño (leve,
 * moderado o grave) no entra al flujo de 24 h (SC-DEV-001.03), y desde CIERRE_FINANCIERO la garantía ya se resolvió.
 */
export function computeWarrantyReleaseAlert(subject: AlertSubject, now: Date): WarrantyReleaseAlert | null {
  if (subject.status !== 'SIN_DANOS' || !subject.receivedAt) return null;
  // DEC-ALQ-COMPANY-DRIVER-004: sin garantia no hay plazo de liberacion (N/A).
  if (subject.depositRequired === false) return null;
  const deadlineAt = new Date(subject.receivedAt.getTime() + WARRANTY_RELEASE_WINDOW_HOURS * HOUR_MS);
  const hoursRemaining = (deadlineAt.getTime() - now.getTime()) / HOUR_MS;
  if (hoursRemaining <= 0) return { level: 'OVERDUE', deadlineAt, hoursRemaining };
  if (hoursRemaining <= WARRANTY_RELEASE_WARNING_LEAD_HOURS) return { level: 'DUE_SOON', deadlineAt, hoursRemaining };
  return null;
}

/**
 * Inmovilización > 24 h sin cobro: mismos criterios de elegibilidad que ChargeImmobilizationHandler (estado CERRADA,
 * al menos un daño TÉCNICO, reloj desde closedAt, días ya cobrados descontados). Devolución sin cerrar = reloj sin arrancar = sin alerta.
 * Solo alerta: el cobro sigue siendo manual (charge-immobilization).
 */
export function computeImmobilizationAlert(subject: AlertSubject, now: Date): ImmobilizationAlert | null {
  // Decision 22-oct-2026: el reloj corre desde el CIERRE; sin cerrar (o sin closedAt) no hay reloj ni alerta.
  if (subject.status !== 'CERRADA' || !subject.closedAt) return null;
  if (!(subject.damages ?? []).some((d) => d.origin === 'TECHNICAL')) return null;

  const rate = subject.vehicleDailyRate !== null && roundMoney(subject.vehicleDailyRate) > 0 ? roundMoney(subject.vehicleDailyRate) : null;
  const calculation = calculateImmobilizationCharge(subject.closedAt, now, rate ?? 0);
  if (!calculation.eligible) return null;
  const alreadyCharged = (subject.immobilizationCharges ?? []).reduce((acc, c) => acc + c.daysCharged, 0);
  const pendingDays = calculation.daysCharged - alreadyCharged;
  if (pendingDays <= 0) return null;
  return {
    since: subject.closedAt,
    hoursElapsed: calculation.hoursElapsed,
    pendingDays,
    dailyRate: rate,
    suggestedAmount: rate === null ? null : roundMoney(pendingDays * rate),
  };
}

export function computeReturnAlerts(subject: AlertSubject, now: Date): ReturnAlerts {
  return {
    warrantyRelease: computeWarrantyReleaseAlert(subject, now),
    immobilization: computeImmobilizationAlert(subject, now),
  };
}

/**
 * Sugerencia de registrar el cargo por retraso manual: vehículo ya recibido, devolución abierta (estados registrables),
 * recepción real posterior a la hora pactada + 30 min (BR-DEV-003) y todavía sin cargo registrado. Se apaga sola al
 * registrar el cargo. Sin monto: el cobro y la cifra son del usuario autorizado.
 */
export function computeLateChargeSuggestion(subject: AlertSubject, now: Date): LateChargeSuggestion | null {
  if (!subject.receivedAt || !subject.scheduledAt) return null;
  if (!LATE_CHARGE_REGISTRABLE_STATUSES.includes(subject.status)) return null;
  if (subject.lateChargeAmount !== null && subject.lateChargeAmount !== undefined) return null;
  const lateness = computeReturnLateness(
    { status: subject.status, scheduledAt: subject.scheduledAt, receivedAt: subject.receivedAt },
    now,
  );
  if (!lateness || !lateness.isLate) return null;
  return { lateMinutes: lateness.lateMinutes, lateToleranceMinutes: RETURN_LATE_TOLERANCE_MINUTES };
}
