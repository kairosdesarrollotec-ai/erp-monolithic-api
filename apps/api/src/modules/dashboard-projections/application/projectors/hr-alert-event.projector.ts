import type { NotificationAction } from '../../../notifications/application/policies/notification-role-policy';

export interface HrAlertEventLike {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
}

/** Tipos de evento de Personal / Reclutamiento que generan alertas en el tablero (Respuestas 2026-10-22 #4). */
export const HR_ALERT_EVENT_TYPES = [
  'SalidaCampoSolicitada.v1',
  'SalidaCampoEscalada.v1',
  'SalidaCampoNoAutorizada.v1',
  'SalidaCampoResuelta.v1',
  'RelacionLaboralTerminada.v1',
  'VacanteCreada.v1',
  'PasoAPlanilla.v1',
] as const;

export const FIELD_TRIP_DASHBOARD_SOURCE_TYPE = 'FIELD_TRIP';
export const HR_DASHBOARD_SOURCE_TYPE = 'HR';
export const RECRUITMENT_DASHBOARD_SOURCE_TYPE = 'RECRUITMENT';

/** Deep link de la cascada de salidas a campo (decision 4). */
export const FIELD_TRIP_DEEP_LINK = '/personal/campo';

export interface HrAlertScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export interface HrAlertItem {
  /** Permiso de notificacion (modulo NOTIFICATIONS) que decide los roles destinatarios. */
  permission: NotificationAction;
  priority: number;
  title: string;
  detail: string | null;
  deepLink: string;
  sourceType: string;
  sourceId: string;
}

export type HrAlertProjection =
  | {
      action: 'ALERT';
      scope: HrAlertScope;
      item: HrAlertItem;
      /** Quita antes los avisos vigentes del mismo origen (p. ej. el nivel anterior de la cascada). */
      replaceSource?: { sourceType: string; sourceId: string };
    }
  | { action: 'DISMISS'; sourceType: string; sourceId: string }
  | { action: 'IGNORE' };

interface FieldTripPayload {
  fieldTripId: string;
  employeeName?: string | null;
  destination?: string | null;
  level?: number;
  outcome?: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

interface TerminationPayload {
  source?: string;
  employeeId?: string | null;
  terminationId?: string | null;
  employeeName?: string | null;
  fullName?: string | null;
  reason?: string;
  areaName?: string | null;
  jobTitle?: string | null;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

interface VacancyPayload {
  vacancyId: string;
  code: string;
  title: string;
  department: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

interface PayrollPayload {
  candidateId: string;
  fullName?: string | null;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

const REASON_LABELS: Record<string, string> = {
  RENUNCIA: 'renuncia',
  DESPIDO: 'despido',
  PRUEBA_NEGATIVA: 'prueba negativa',
};

function scopeOf(p: { organizationId: string; operatingCompanyId: string; branchId: string }): HrAlertScope {
  return { organizationId: p.organizationId, operatingCompanyId: p.operatingCompanyId, branchId: p.branchId };
}

/**
 * Respuestas 2026-10-22 #4 - proyecta a alertas del tablero los eventos de la cascada de salidas a campo (solicitud creada, escalada
 * de nivel, nadie autorizo) y de Talento Humano (terminacion laboral, vacante creada, paso a planilla). Los destinatarios los decide
 * el PERMISO `permission` (NOTIFICATIONS.RECEIVE_FIELD_TRIP_ALERTS / RECEIVE_HR_ALERTS, v0 = Gerencia, editable en ADM-02).
 * La salida resuelta (autorizada o rechazada) descarta los avisos vigentes de esa salida.
 */
export function projectHrAlertEvent(event: HrAlertEventLike): HrAlertProjection {
  switch (event.eventType) {
    case 'SalidaCampoSolicitada.v1': {
      const p = event.payload as FieldTripPayload;
      return {
        action: 'ALERT',
        scope: scopeOf(p),
        item: {
          permission: 'RECEIVE_FIELD_TRIP_ALERTS',
          priority: 70,
          title: `Salida a campo solicitada: ${p.employeeName ?? 'colaborador'}${p.destination ? ` a ${p.destination}` : ''}. Espera autorización (nivel 1 de 3).`,
          detail: null,
          deepLink: FIELD_TRIP_DEEP_LINK,
          sourceType: FIELD_TRIP_DASHBOARD_SOURCE_TYPE,
          sourceId: p.fieldTripId,
        },
      };
    }
    case 'SalidaCampoEscalada.v1': {
      const p = event.payload as FieldTripPayload;
      return {
        action: 'ALERT',
        scope: scopeOf(p),
        replaceSource: { sourceType: FIELD_TRIP_DASHBOARD_SOURCE_TYPE, sourceId: p.fieldTripId },
        item: {
          permission: 'RECEIVE_FIELD_TRIP_ALERTS',
          priority: 80 + (p.level ?? 2),
          title: `Salida a campo sin respuesta: escaló al nivel ${p.level ?? 2} de 3 (${p.employeeName ?? 'colaborador'}).`,
          detail: p.destination ? `Destino: ${p.destination}` : null,
          deepLink: FIELD_TRIP_DEEP_LINK,
          sourceType: FIELD_TRIP_DASHBOARD_SOURCE_TYPE,
          sourceId: p.fieldTripId,
        },
      };
    }
    case 'SalidaCampoNoAutorizada.v1': {
      const p = event.payload as FieldTripPayload;
      return {
        action: 'ALERT',
        scope: scopeOf(p),
        replaceSource: { sourceType: FIELD_TRIP_DASHBOARD_SOURCE_TYPE, sourceId: p.fieldTripId },
        item: {
          permission: 'RECEIVE_FIELD_TRIP_ALERTS',
          priority: 95,
          title: `Nadie autorizó la salida a campo de ${p.employeeName ?? 'un colaborador'}: quedó NO AUTORIZADA y la persona no sale.`,
          detail: p.destination ? `Destino: ${p.destination}` : null,
          deepLink: FIELD_TRIP_DEEP_LINK,
          sourceType: FIELD_TRIP_DASHBOARD_SOURCE_TYPE,
          sourceId: p.fieldTripId,
        },
      };
    }
    case 'SalidaCampoResuelta.v1': {
      const p = event.payload as FieldTripPayload;
      return { action: 'DISMISS', sourceType: FIELD_TRIP_DASHBOARD_SOURCE_TYPE, sourceId: p.fieldTripId };
    }
    case 'RelacionLaboralTerminada.v1': {
      const p = event.payload as TerminationPayload;
      const who = p.employeeName ?? p.fullName ?? 'Un colaborador';
      const reason = REASON_LABELS[p.reason ?? ''] ?? (p.reason ?? 'terminación');
      const role = [p.jobTitle, p.areaName].filter(Boolean).join(' · ');
      const fromProbation = p.source === 'PROBATION_NEGATIVE' || !p.employeeId;
      return {
        action: 'ALERT',
        scope: scopeOf(p),
        item: {
          permission: 'RECEIVE_HR_ALERTS',
          priority: 75,
          title: `Terminación laboral registrada: ${who} (${reason}).`,
          detail: role || null,
          deepLink: fromProbation ? '/reclutamiento' : '/personal',
          sourceType: HR_DASHBOARD_SOURCE_TYPE,
          sourceId: p.terminationId ?? event.aggregateId,
        },
      };
    }
    case 'VacanteCreada.v1': {
      const p = event.payload as VacancyPayload;
      return {
        action: 'ALERT',
        scope: scopeOf(p),
        item: {
          permission: 'RECEIVE_HR_ALERTS',
          priority: 65,
          title: `Vacante creada ${p.code}: ${p.title} (${p.department}).`,
          detail: 'Se creó automáticamente a partir de una terminación laboral.',
          deepLink: '/reclutamiento',
          sourceType: RECRUITMENT_DASHBOARD_SOURCE_TYPE,
          sourceId: p.vacancyId,
        },
      };
    }
    case 'PasoAPlanilla.v1': {
      const p = event.payload as PayrollPayload;
      return {
        action: 'ALERT',
        scope: scopeOf(p),
        item: {
          permission: 'RECEIVE_HR_ALERTS',
          priority: 55,
          title: `Pasó a planilla: ${p.fullName ?? 'colaborador'} aprobó el periodo de prueba.`,
          detail: null,
          deepLink: '/reclutamiento',
          sourceType: RECRUITMENT_DASHBOARD_SOURCE_TYPE,
          sourceId: p.candidateId,
        },
      };
    }
    default:
      return { action: 'IGNORE' };
  }
}
