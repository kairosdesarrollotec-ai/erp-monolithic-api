/**
 * DEC-AUTH-LOCKOUT-001 (R2, 23-oct-2026): 5 fallos consecutivos en 15 min provocan bloqueo temporal
 * de 15 min con desbloqueo automatico y emision de alerta a Administracion en el tablero.
 */
export const LOGIN_FAILURE_ALERT_THRESHOLD = 5;
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
