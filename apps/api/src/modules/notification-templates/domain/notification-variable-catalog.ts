/**
 * ADM-05 (PANTALLAS-V2-B-SOPORTE.md, contrato punto 8 y criterio de
 * aceptacion 14): "sin datos sensibles en logs ni mensajes" - la
 * plantilla solo puede usar variables ya validadas como seguras, nunca
 * un dato personal completo (ej. `{dni_completo}`, `{documento_completo}`
 * jamas aparecen como opcion).
 */
export const ALLOWED_NOTIFICATION_VARIABLES: readonly string[] = ['nombre', 'fecha', 'vehiculo', 'sede', 'monto'];

export { NOTIFICATION_CHANNELS, NotificationChannel } from '../../../common/domain/notification-channel';

const VARIABLE_PATTERN = /\{([a-zA-Z_]+)\}/g;

export function extractVariables(body: string): string[] {
  const matches = [...body.matchAll(VARIABLE_PATTERN)];
  return matches.map((match) => match[1]);
}

export function findUnsafeVariables(body: string): string[] {
  const found = extractVariables(body);
  return found.filter((variable) => !ALLOWED_NOTIFICATION_VARIABLES.includes(variable));
}
