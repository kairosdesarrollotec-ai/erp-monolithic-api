import {
  AUTH_EVENT_MIN_RETENTION_DAYS,
  LOGIN_FAILURE_ALERT_THRESHOLD,
  countConsecutiveFailures,
  loginFailureWindowStart,
  shouldRaiseLoginFailureAlert,
} from './login-failure-policy';

describe('login-failure-policy (B8)', () => {
  it('constantes de negocio: 10 fallos, retencion minima 1 anio', () => {
    expect(LOGIN_FAILURE_ALERT_THRESHOLD).toBe(10);
    expect(AUTH_EVENT_MIN_RETENTION_DAYS).toBe(365);
  });
  it('cuenta la racha hasta el primer SUCCESS', () => {
    expect(countConsecutiveFailures([{ outcome: 'FAILURE' }, { outcome: 'FAILURE' }, { outcome: 'SUCCESS' }, { outcome: 'FAILURE' }])).toBe(2);
    expect(countConsecutiveFailures([])).toBe(0);
  });
  it('alerta solo en >=10 y sin alerta previa', () => {
    expect(shouldRaiseLoginFailureAlert(10, false)).toBe(true);
    expect(shouldRaiseLoginFailureAlert(9, false)).toBe(false);
    expect(shouldRaiseLoginFailureAlert(10, true)).toBe(false);
  });
  it('la ventana es de 15 minutos', () => {
    const now = new Date('2026-10-21T10:15:00Z');
    expect(loginFailureWindowStart(now).toISOString()).toBe('2026-10-21T10:00:00.000Z');
  });
});
