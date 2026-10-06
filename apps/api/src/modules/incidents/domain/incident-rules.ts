import { IncidentNotOpenError, IncidentDirectResolveNotAllowedError, IncidentInvalidTextError } from './incident-errors';
import type { IncidentSeverity, IncidentStatus } from './incident-catalog';

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
