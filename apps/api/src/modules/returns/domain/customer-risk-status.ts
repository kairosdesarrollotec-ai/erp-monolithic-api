import { DamageSeverity } from './return-status';

/**
 * Semáforo de riesgo del cliente (BR-DEV-007 / BR-DEV-008, TD-DEV-002, invariantes 3 y 7 del TDD-DEV-001).
 * Se persiste en `Customer.status` (String). NORMAL equivale a SIN_OBSERVACIÓN en los documentos.
 * Regla de SOLO AVANCE: NORMAL -> AMBAR -> ROJO; nunca retrocede.
 */
export type CustomerRiskStatus = 'NORMAL' | 'AMBAR' | 'ROJO';

export const CUSTOMER_RISK_STATUSES: readonly CustomerRiskStatus[] = ['NORMAL', 'AMBAR', 'ROJO'];

const RISK_RANK: Readonly<Record<CustomerRiskStatus, number>> = { NORMAL: 0, AMBAR: 1, ROJO: 2 };

/** Cualquier valor desconocido/legado (p. ej. SIN_OBSERVACION) se trata como NORMAL. */
export function normalizeCustomerRiskStatus(raw: string | null | undefined): CustomerRiskStatus {
  return raw === 'AMBAR' || raw === 'ROJO' ? raw : 'NORMAL';
}

/** Devuelve el más grave entre el estado actual y el solicitado: jamás degrada el semáforo. */
export function escalateCustomerRiskStatus(
  current: CustomerRiskStatus,
  requested: CustomerRiskStatus,
): CustomerRiskStatus {
  return RISK_RANK[requested] > RISK_RANK[current] ? requested : current;
}

/** Estados que ya igualan o superan al objetivo (los que NO deben sobrescribirse al avanzar). */
export function riskStatusesAtOrAbove(target: CustomerRiskStatus): CustomerRiskStatus[] {
  return CUSTOMER_RISK_STATUSES.filter((s) => RISK_RANK[s] >= RISK_RANK[target]);
}

/**
 * Objetivo del semáforo tras evaluar un daño (BR-DEV-007):
 *  - GRAVE -> ROJO siempre.
 *  - LEVE o MODERADO con `customerAcceptsCost === true` -> AMBAR.
 *  - Otro caso -> null (sin cambio).
 */
export function resolveRiskTargetAfterDamage(
  severity: DamageSeverity,
  customerAcceptsCost: boolean | undefined,
): CustomerRiskStatus | null {
  if (severity === 'GRAVE') return 'ROJO';
  if (customerAcceptsCost === true) return 'AMBAR';
  return null;
}
