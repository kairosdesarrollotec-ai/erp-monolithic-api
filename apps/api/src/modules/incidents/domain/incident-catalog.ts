/**
 * Catalogos del modulo Incidencias (INC-01/INC-02). Fuente unica de los valores en tiempo de ejecucion:
 * `incidents-openapi.contract.spec.ts` verifica que coincidan con `packages/contracts/openapi/incidents.yaml`
 * y con los enums de `schema.prisma`.
 */
export const INCIDENT_TYPES = ['KEY_LOSS', 'CRASH_OR_DAMAGE', 'TRAFFIC_FINE_OR_INTERVENTION', 'TOWING', 'OTHER', 'UNAUTHORIZED_DRIVER'] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

/**
 * DEC-ALQ-UNAUTH-DRIVER-003: tipos cuya DECISION (resolver/cerrar/derivar a via legal) es exclusiva de Gerencia, caso por
 * caso. Registrar la incidencia NO dispara ninguna consecuencia automatica (ni retencion de garantia, ni resolucion del
 * contrato, ni cliente rojo): la decision de Gerencia queda en el historial append-only (resolucion/motivo).
 */
export const MANAGEMENT_DECISION_INCIDENT_TYPES: readonly IncidentType[] = ['UNAUTHORIZED_DRIVER'];

/** Severidades admitidas por tipo (solo los tipos con restriccion). UNAUTHORIZED_DRIVER es siempre GRAVE. */
export const INCIDENT_SEVERITIES_BY_TYPE: Readonly<Partial<Record<IncidentType, readonly IncidentSeverity[]>>> = {
  UNAUTHORIZED_DRIVER: ['GRAVE'],
};

export const INCIDENT_SEVERITIES = ['LEVE', 'MODERADA', 'GRAVE'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

/** SDD 11.1: Abierta -> Cerrada / Via legal. CERRADA y VIA_LEGAL son terminales. */
export const INCIDENT_STATUSES = ['ABIERTA', 'CERRADA', 'VIA_LEGAL'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_ACTION_KINDS = ['REPORTED', 'ACTION', 'RESOLVED', 'CLOSED', 'REFERRED_LEGAL'] as const;
export type IncidentActionKind = (typeof INCIDENT_ACTION_KINDS)[number];

export const INCIDENT_LIST_DEFAULT_LIMIT = 20;
export const INCIDENT_LIST_MAX_LIMIT = 100;
export const INCIDENT_TEXT_MAX_LENGTH = 2000;
