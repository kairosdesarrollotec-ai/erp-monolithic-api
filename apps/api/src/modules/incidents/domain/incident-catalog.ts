/**
 * Catalogos del modulo Incidencias (INC-01/INC-02). Fuente unica de los valores en tiempo de ejecucion:
 * `incidents-openapi.contract.spec.ts` verifica que coincidan con `packages/contracts/openapi/incidents.yaml`
 * y con los enums de `schema.prisma`.
 */
export const INCIDENT_TYPES = ['KEY_LOSS', 'CRASH_OR_DAMAGE', 'TRAFFIC_FINE_OR_INTERVENTION', 'TOWING', 'OTHER'] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

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
