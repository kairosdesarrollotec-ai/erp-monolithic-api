import {
  IncidentNotOpenError,
  IncidentDirectResolveNotAllowedError,
  IncidentInvalidTextError,
  IncidentManagementDecisionRequiredError,
  IncidentSeverityNotAllowedForTypeError,
  IncidentDecisionOutcomeRequiredError,
  IncidentDecisionOutcomeNotApplicableError,
} from './incident-errors';
import {
  INCIDENT_SEVERITIES_BY_TYPE,
  MANAGEMENT_DECISION_INCIDENT_TYPES,
  type IncidentActionKind,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentType,
  type ManagementDecisionOutcome,
} from './incident-catalog';

/** Solo ABIERTA admite agregar acciones, resolver, cerrar o derivar (CERRADA y VIA_LEGAL son terminales). */
export function assertIncidentOpen(status: IncidentStatus): void {
  if (status !== 'ABIERTA') {
    throw new IncidentNotOpenError(status);
  }
}

/** INC-01 criterio 14: "Resolver" directo solo para incidencias simples (severidad LEVE). */
export function canResolveDirectly(severity: IncidentSeverity): boolean {
  return severity === 'LEVE';
}

export function assertDirectResolveAllowed(severity: IncidentSeverity): void {
  if (!canResolveDirectly(severity)) {
    throw new IncidentDirectResolveNotAllowedError(severity);
  }
}

/** DEV-09 / NFR-KAI-008: solo una incidencia ABIERTA impide liberar la garantia / cerrar la devolucion. */
export function isBlockingIncident(status: IncidentStatus): boolean {
  return status === 'ABIERTA';
}

/** Recorta y exige contenido: un resumen/motivo en blanco no cuenta como texto (400). */
export function requireText(value: string | null | undefined, field: string): string {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) {
    throw new IncidentInvalidTextError(field);
  }
  return trimmed;
}

/** DEC-ALQ-UNAUTH-DRIVER-003: severidades validas por tipo (422 si el tipo la restringe y no coincide). */
export function assertSeverityAllowedForType(type: IncidentType, severity: IncidentSeverity): void {
  const allowed = INCIDENT_SEVERITIES_BY_TYPE[type];
  if (allowed && !allowed.includes(severity)) {
    throw new IncidentSeverityNotAllowedForTypeError(type, severity, allowed);
  }
}

/** Entradas del historial que constituyen una DECISION (el resto, p. ej. ACTION, queda abierto a Front-office). */
const DECISION_ACTION_KINDS: ReadonlySet<IncidentActionKind> = new Set(['RESOLVED', 'CLOSED', 'REFERRED_LEGAL']);

/**
 * DEC-ALQ-UNAUTH-DRIVER-003: capa adicional a la matriz INCIDENT.*: para tipos de decision de Gerencia, resolver/cerrar/
 * derivar exige rol de sistema GERENCIA (un rol personalizado sin clave de sistema queda excluido: criterio conservador).
 */
export function assertManagementDecisionAllowed(type: IncidentType, kind: IncidentActionKind, roleKey: string | null): void {
  if (MANAGEMENT_DECISION_INCIDENT_TYPES.includes(type) && DECISION_ACTION_KINDS.has(kind) && roleKey !== 'GERENCIA') {
    throw new IncidentManagementDecisionRequiredError(type);
  }
}

/**
 * DEC-ALQ-UNAUTH-DRIVER-003: para los tipos de decision de Gerencia el resultado estructurado es obligatorio (422
 * MANAGEMENT_DECISION_OUTCOME_REQUIRED); para el resto no aplica (422 MANAGEMENT_DECISION_OUTCOME_NOT_APPLICABLE).
 */
export function assertDecisionOutcomeForType(type: IncidentType, outcome: ManagementDecisionOutcome | undefined): void {
  const managed = MANAGEMENT_DECISION_INCIDENT_TYPES.includes(type);
  if (managed && !outcome) {
    throw new IncidentDecisionOutcomeRequiredError(type);
  }
  if (!managed && outcome) {
    throw new IncidentDecisionOutcomeNotApplicableError(type);
  }
}

/** Texto legible del resultado de la decision (queda como encabezado de la entrada append-only del historial). */
export function describeDecisionOutcome(outcome: ManagementDecisionOutcome): string {
  const guarantee = outcome.retainGuarantee ? 'se retiene la garantia' : 'no se retiene la garantia';
  const contract = outcome.terminateContract ? 'se resuelve el contrato' : 'se mantiene el contrato';
  return `Decision de Gerencia: ${guarantee}; ${contract}.`;
}
