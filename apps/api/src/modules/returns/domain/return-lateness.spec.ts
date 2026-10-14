import { computeReturnLateness, RETURN_LATE_TOLERANCE_MINUTES } from './return-lateness';
import { RETURN_REMINDER_TOLERANCE_MINUTES } from './return-reminder';

const SCHEDULED = new Date('2026-10-15T15:00:00.000Z');
const at = (min: number): Date => new Date(SCHEDULED.getTime() + min * 60000);

describe('computeReturnLateness (BR-DEV-003, tolerancia 30 min)', () => {
  it('la tolerancia es 30 min y el recordatorio usa la misma constante', () => {
    expect(RETURN_LATE_TOLERANCE_MINUTES).toBe(30);
    expect(RETURN_REMINDER_TOLERANCE_MINUTES).toBe(RETURN_LATE_TOLERANCE_MINUTES);
  });

  it('recibido a tiempo o antes: no es retraso', () => {
    expect(computeReturnLateness({ status: 'INSPECCION', scheduledAt: SCHEDULED, receivedAt: at(-20) }, at(100))).toEqual({
      lateToleranceMinutes: 30, lateMinutes: 0, isLate: false, basis: 'RECEIVED',
    });
  });

  it('hasta 30 min tarde (inclusive) no cuenta como retraso', () => {
    const r = computeReturnLateness({ status: 'INSPECCION', scheduledAt: SCHEDULED, receivedAt: at(30) }, at(500));
    expect(r).toMatchObject({ lateMinutes: 30, isLate: false });
  });

  it('31 min tarde sí es retraso', () => {
    const r = computeReturnLateness({ status: 'INSPECCION', scheduledAt: SCHEDULED, receivedAt: at(31) }, at(500));
    expect(r).toMatchObject({ lateMinutes: 31, isLate: true, basis: 'RECEIVED' });
  });

  it('30 min y 1 s tarde ya es retraso (estricto)', () => {
    const received = new Date(at(30).getTime() + 1000);
    expect(computeReturnLateness({ status: 'INSPECCION', scheduledAt: SCHEDULED, receivedAt: received }, at(500))?.isLate).toBe(true);
  });

  it('sin recepción mide contra el reloj (parcial)', () => {
    expect(computeReturnLateness({ status: 'PROGRAMADA', scheduledAt: SCHEDULED, receivedAt: null }, at(10))).toMatchObject({ isLate: false, basis: 'NOW' });
    expect(computeReturnLateness({ status: 'PROGRAMADA', scheduledAt: SCHEDULED, receivedAt: null }, at(45))).toMatchObject({ lateMinutes: 45, isLate: true, basis: 'NOW' });
  });

  it('CANCELADA sin recepción: no aplica', () => {
    expect(computeReturnLateness({ status: 'CANCELADA', scheduledAt: SCHEDULED, receivedAt: null }, at(90))).toBeNull();
  });
});
