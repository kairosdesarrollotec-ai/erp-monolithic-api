/**
 * DEC-DEVREM-002 - Alerta de garantía a las 24 h (BR-DEV-001, SC-DEV-001.02) proyectada al tablero (TR-06) como
 * `dashboard_items` de tipo ALERT. Destinatarios (Respuestas 2026-10-20 #8): los roles cuyo usuario tiene el permiso
 * NOTIFICATIONS.RECEIVE_RETURN_ALERTS en la empresa/sede de la devolución — ya NO un rol fijo (Finanzas es solo el destinatario
 * histórico y sigue recibiéndola por defecto). Un item por devolución, nivel y rol destinatario. SOLO alerta: nunca ejecuta el
 * reembolso (DEC-DEV-WARRANTY-ALERT-001).
 *
 * Idempotencia: clave natural `return-warranty:<NIVEL>:<returnId>` en `source_event_id` + índice único existente
 * (source_event_id, item_type). Un nivel se publica UNA vez por devolución, sin importar cuántas veces corra el job ni
 * cuántas réplicas lo ejecuten (INSERT ... ON CONFLICT DO NOTHING). El texto no lleva datos personales del cliente.
 */
import { formatLimaDateTime } from '../../../common/time/lima-time';
import type { WorkerRole } from '../../users/domain/worker-role';
import type { ImmobilizationAlert, LateChargeSuggestion, WarrantyReleaseAlert, WarrantyReleaseAlertLevel } from './return-alerts';

export const RETURN_DASHBOARD_SOURCE_TYPE = 'RETURN';
export const WARRANTY_DASHBOARD_KEY_PREFIX = 'return-warranty';
/** Rol destinatario historico: conserva la clave natural SIN sufijo de rol (compatibilidad con items ya publicados). */
export const WARRANTY_DASHBOARD_LEGACY_ROLE = 'FINANZAS' as const satisfies WorkerRole;
/** Permiso que decide quien recibe estas alertas (modulo NOTIFICATIONS de ADM-02). */
export const RETURN_ALERT_PERMISSION = { module: 'NOTIFICATIONS', action: 'RECEIVE_RETURN_ALERTS' } as const;
/** Mayor = más urgente (TR-06 ordena por prioridad). Vencida pasa por delante de "por vencer". */
export const WARRANTY_DASHBOARD_PRIORITY: Record<WarrantyReleaseAlertLevel, number> = { DUE_SOON: 60, OVERDUE: 90 };

export interface ReturnDashboardItemInput {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  role: WorkerRole;
  itemType: 'ALERT';
  priority: number;
  title: string;
  detail: string | null;
  deepLink: string;
  sourceType: typeof RETURN_DASHBOARD_SOURCE_TYPE;
  sourceId: string;
  sourceEventId: string;
}

/**
 * Clave natural `return-warranty:<NIVEL>:<returnId>[:<ROL>]`. El rol historico (FINANZAS) NO lleva sufijo, para no duplicar los
 * items que ya estaban publicados; cualquier otro rol destinatario agrega `:<ROL>` (la unicidad es (source_event_id, item_type)).
 */
export function warrantyDashboardKey(level: WarrantyReleaseAlertLevel, returnId: string, role: WorkerRole = WARRANTY_DASHBOARD_LEGACY_ROLE): string {
  const base = `${WARRANTY_DASHBOARD_KEY_PREFIX}:${level}:${returnId}`;
  return role === WARRANTY_DASHBOARD_LEGACY_ROLE ? base : `${base}:${role}`;
}

/** Nivel codificado en la clave natural; null si la clave no es de esta alerta. */
export function parseWarrantyDashboardLevel(sourceEventId: string): WarrantyReleaseAlertLevel | null {
  const [prefix, level] = sourceEventId.split(':');
  if (prefix !== WARRANTY_DASHBOARD_KEY_PREFIX) return null;
  return level === 'DUE_SOON' || level === 'OVERDUE' ? level : null;
}

export interface WarrantyDashboardSubject {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  vehiclePlate: string | null;
}

export function buildWarrantyDashboardItem(
  subject: WarrantyDashboardSubject,
  alert: WarrantyReleaseAlert,
  role: WorkerRole = WARRANTY_DASHBOARD_LEGACY_ROLE,
): ReturnDashboardItemInput {
  const deadline = formatLimaDateTime(alert.deadlineAt);
  return {
    organizationId: subject.organizationId,
    operatingCompanyId: subject.operatingCompanyId,
    branchId: subject.branchId,
    role,
    itemType: 'ALERT',
    priority: WARRANTY_DASHBOARD_PRIORITY[alert.level],
    title:
      alert.level === 'OVERDUE'
        ? `Garantía vencida: el plazo de 24 h terminó el ${deadline} (hora de Lima)`
        : `Garantía por liberar antes del ${deadline} (hora de Lima)`,
    detail: subject.vehiclePlate ? `Vehículo ${subject.vehiclePlate}` : null,
    deepLink: `/devoluciones/${subject.id}/garantia`,
    sourceType: RETURN_DASHBOARD_SOURCE_TYPE,
    sourceId: subject.id,
    sourceEventId: warrantyDashboardKey(alert.level, subject.id, role),
  };
}

/**
 * P3 (frente B2, 21-oct-2026; Respuestas 2026-10-20 #7, #8, #9) - las otras dos alertas de devolucion al tablero, con los MISMOS
 * destinatarios por permiso (NOTIFICATIONS.RECEIVE_RETURN_ALERTS) y la misma idempotencia que la de garantia:
 *  - LATE_CHARGE: sugerencia de registrar el cargo por retraso (manual; el monto lo digita la persona). Clave
 *    `return-late-charge:<returnId>:<ROL>`; deja de salir sola al registrar el cargo (la conciliacion la descarta).
 *  - IMMOBILIZATION: inmovilizacion > 24 h por dano tecnico (cobro manual). Clave `return-immobilization:<returnId>:<ROL>`; se
 *    descarta al cobrarse los dias pendientes. Un item por devolucion y rol (no uno por dia): el detalle muestra los dias al publicar.
 * Como son claves nuevas, TODOS los roles (tambien FINANZAS) llevan el sufijo `:<ROL>`.
 */
export const LATE_CHARGE_DASHBOARD_KEY_PREFIX = 'return-late-charge';
export const IMMOBILIZATION_DASHBOARD_KEY_PREFIX = 'return-immobilization';
export const LATE_CHARGE_DASHBOARD_PRIORITY = 55;
export const IMMOBILIZATION_DASHBOARD_PRIORITY = 75;

export type ReturnDashboardAlertKind = 'WARRANTY' | 'LATE_CHARGE' | 'IMMOBILIZATION';

export function lateChargeDashboardKey(returnId: string, role: WorkerRole): string {
  return `${LATE_CHARGE_DASHBOARD_KEY_PREFIX}:${returnId}:${role}`;
}

export function immobilizationDashboardKey(returnId: string, role: WorkerRole): string {
  return `${IMMOBILIZATION_DASHBOARD_KEY_PREFIX}:${returnId}:${role}`;
}

/** Familia de alerta codificada en la clave natural; null si la clave no es de ninguna alerta de devolucion. */
export function returnDashboardAlertKind(sourceEventId: string): ReturnDashboardAlertKind | null {
  const prefix = sourceEventId.split(':')[0];
  if (prefix === WARRANTY_DASHBOARD_KEY_PREFIX) return 'WARRANTY';
  if (prefix === LATE_CHARGE_DASHBOARD_KEY_PREFIX) return 'LATE_CHARGE';
  if (prefix === IMMOBILIZATION_DASHBOARD_KEY_PREFIX) return 'IMMOBILIZATION';
  return null;
}

export function buildLateChargeDashboardItem(
  subject: WarrantyDashboardSubject,
  suggestion: LateChargeSuggestion,
  role: WorkerRole,
): ReturnDashboardItemInput {
  const plate = subject.vehiclePlate ? `Vehículo ${subject.vehiclePlate}. ` : '';
  return {
    organizationId: subject.organizationId,
    operatingCompanyId: subject.operatingCompanyId,
    branchId: subject.branchId,
    role,
    itemType: 'ALERT',
    priority: LATE_CHARGE_DASHBOARD_PRIORITY,
    title: 'Devolución con retraso: registre el cargo por retraso',
    detail: `${plate}Retraso de ${suggestion.lateMinutes} min (tolerancia ${suggestion.lateToleranceMinutes} min). El cargo es manual: el monto lo digita la persona autorizada.`,
    deepLink: `/devoluciones/${subject.id}`,
    sourceType: RETURN_DASHBOARD_SOURCE_TYPE,
    sourceId: subject.id,
    sourceEventId: lateChargeDashboardKey(subject.id, role),
  };
}

export function buildImmobilizationDashboardItem(
  subject: WarrantyDashboardSubject,
  alert: ImmobilizationAlert,
  role: WorkerRole,
): ReturnDashboardItemInput {
  const plate = subject.vehiclePlate ? `Vehículo ${subject.vehiclePlate}. ` : '';
  const amount = alert.suggestedAmount !== null ? ` Monto de referencia: S/ ${alert.suggestedAmount.toFixed(2)}.` : '';
  return {
    organizationId: subject.organizationId,
    operatingCompanyId: subject.operatingCompanyId,
    branchId: subject.branchId,
    role,
    itemType: 'ALERT',
    priority: IMMOBILIZATION_DASHBOARD_PRIORITY,
    title: 'Inmovilización de más de 24 h por daño técnico: corresponde cobro',
    detail: `${plate}${alert.pendingDays} día(s) pendientes de cobro desde el ${formatLimaDateTime(alert.since)} (hora de Lima).${amount} El cobro es manual.`,
    deepLink: `/devoluciones/${subject.id}`,
    sourceType: RETURN_DASHBOARD_SOURCE_TYPE,
    sourceId: subject.id,
    sourceEventId: immobilizationDashboardKey(subject.id, role),
  };
}
