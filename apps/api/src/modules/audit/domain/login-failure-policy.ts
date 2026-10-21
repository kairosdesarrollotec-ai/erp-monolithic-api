/**
 * B8 (Respuestas 2026-10-20/21): los fallos de login NO bloquean la cuenta; se registran como evento de
 * seguridad (audit_events, entityType 'auth', retencion minima 1 anio: audit_events no se purga) y,
 * al llegar a >= 10 fallos CONSECUTIVOS del mismo identificador en 15 minutos, se alerta a Administracion.
 */
export const LOGIN_FAILURE_ALERT_THRESHOLD = 10;
export const LOGIN_FAILURE_WINDOW_MINUTES = 15;
export const LOGIN_FAILURE_ALERT_ACTION = 'LOGIN_FAILURE_THRESHOLD';
/** Retencion minima del evento de seguridad (dias). audit_events no tiene purga; este valor documenta el piso. */
export const AUTH_EVENT_MIN_RETENTION_DAYS = 365;

export interface LoginAttemptLite {
  outcome: 'SUCCESS' | 'FAILURE';
}

/** Cuenta los fallos consecutivos mas recientes (la lista viene de mas nuevo a mas viejo); un SUCCESS corta la racha. */
export function countConsecutiveFailures(attemptsNewestFirst: readonly LoginAttemptLite[]): number {
  let count = 0;
  for (const attempt of attemptsNewestFirst) {
    if (attempt.outcome !== 'FAILURE') break;
    count += 1;
  }
  return count;
}

export function shouldRaiseLoginFailureAlert(consecutiveFailures: number, alreadyRaisedInWindow: boolean): boolean {
  return consecutiveFailures >= LOGIN_FAILURE_ALERT_THRESHOLD && !alreadyRaisedInWindow;
}

export function loginFailureWindowStart(now: Date): Date {
  return new Date(now.getTime() - LOGIN_FAILURE_WINDOW_MINUTES * 60_000);
}
