import { InvalidReturnStateTransitionError } from './return-errors';

export type ReturnStatus =
  | 'PROGRAMADA'
  | 'RECEPCION_PROVISIONAL'
  | 'INSPECCION'
  | 'SIN_DANOS'
  | 'CON_DANOS'
  | 'CIERRE_FINANCIERO'
  | 'CERRADA'
  | 'CANCELADA';

export type CustodyHolder = 'CLIENTE' | 'VELOXRENT' | 'TALLER';

export type DamageOrigin = 'AESTHETIC' | 'TECHNICAL';

export type DamageSeverity = 'LEVE' | 'MODERADO' | 'GRAVE';

export type ReturnFuelLevel = 'EMPTY' | 'ONE_QUARTER' | 'HALF' | 'THREE_QUARTERS' | 'FULL';

export type AlcoholTestResult = 'FAVORABLE' | 'DESFAVORABLE' | 'RECHAZADO';

export type ReturnEvidenceType = 'PHOTO' | 'VIDEO';

/**
 * PROVISIONAL (PROP-014): decisión de Gerencia ante un alcolímetro de salida DESFAVORABLE/RECHAZADO.
 * Los documentos fuente no definen las opciones.
 */
export type AlcoholEscalationDecision = 'CONTINUE_TO_INSPECTION' | 'KEEP_IN_CUSTODY';

/**
 * Transiciones válidas según TDD-04-devolucion seccion 8.2 y BDD-04-devolucion seccion 11.2:
 * PROGRAMADA -> RECEPCION_PROVISIONAL, CANCELADA
 * RECEPCION_PROVISIONAL -> INSPECCION, CANCELADA (permanece en RECEPCION_PROVISIONAL si alcohol es desfavorable)
 * INSPECCION -> SIN_DANOS, CON_DANOS
 * SIN_DANOS -> CIERRE_FINANCIERO
 * CON_DANOS -> CIERRE_FINANCIERO
 * CIERRE_FINANCIERO -> CERRADA
 */
export const ALLOWED_RETURN_TRANSITIONS: ReadonlyMap<ReturnStatus, ReadonlySet<ReturnStatus>> = new Map([
  ['PROGRAMADA', new Set<ReturnStatus>(['RECEPCION_PROVISIONAL', 'CANCELADA'])],
  ['RECEPCION_PROVISIONAL', new Set<ReturnStatus>(['INSPECCION', 'CANCELADA'])],
  ['INSPECCION', new Set<ReturnStatus>(['SIN_DANOS', 'CON_DANOS'])],
  ['SIN_DANOS', new Set<ReturnStatus>(['CIERRE_FINANCIERO'])],
  ['CON_DANOS', new Set<ReturnStatus>(['CIERRE_FINANCIERO'])],
  ['CIERRE_FINANCIERO', new Set<ReturnStatus>(['CERRADA'])],
  ['CERRADA', new Set<ReturnStatus>()],
  ['CANCELADA', new Set<ReturnStatus>()],
]);

export function canTransitionReturn(current: ReturnStatus, next: ReturnStatus): boolean {
  if (current === next) return true;
  const allowed = ALLOWED_RETURN_TRANSITIONS.get(current);
  return allowed ? allowed.has(next) : false;
}

export function assertCanTransitionReturn(current: ReturnStatus, next: ReturnStatus): void {
  if (!canTransitionReturn(current, next)) {
    throw new InvalidReturnStateTransitionError(current, next);
  }
}

export const RETURN_STATUSES: readonly ReturnStatus[] = [
  'PROGRAMADA',
  'RECEPCION_PROVISIONAL',
  'INSPECCION',
  'SIN_DANOS',
  'CON_DANOS',
  'CIERRE_FINANCIERO',
  'CERRADA',
  'CANCELADA',
];
export const DAMAGE_ORIGINS: readonly DamageOrigin[] = ['AESTHETIC', 'TECHNICAL'];
export const DAMAGE_SEVERITIES: readonly DamageSeverity[] = ['LEVE', 'MODERADO', 'GRAVE'];
export const RETURN_FUEL_LEVELS: readonly ReturnFuelLevel[] = ['EMPTY', 'ONE_QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL'];
export const ALCOHOL_TEST_RESULTS: readonly AlcoholTestResult[] = ['FAVORABLE', 'DESFAVORABLE', 'RECHAZADO'];
export const RETURN_EVIDENCE_TYPES: readonly ReturnEvidenceType[] = ['PHOTO', 'VIDEO'];
export const ALCOHOL_ESCALATION_DECISIONS: readonly AlcoholEscalationDecision[] = ['CONTINUE_TO_INSPECTION', 'KEEP_IN_CUSTODY'];
