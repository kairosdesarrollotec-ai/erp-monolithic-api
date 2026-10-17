import {
  computeReturnLateness,
  computeReturnLatenessCharge,
  latenessTierForDelta,
  RETURN_LATE_TOLERANCE_MINUTES,
} from './return-lateness';
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

describe('computeReturnLatenessCharge (DEC-DEV-LATE-CHARGE-001, VR-GA-PA-VS.04)', () => {
  const base = { dailyRate: 200 as number | null, deposit: { originalAmount: 1000, currency: 'PEN' } as { originalAmount: number; currency: string } | null };
  const charge = (min: number, inputs: Parameters<typeof computeReturnLatenessCharge>[2] = { ...base, extensions: [] }) =>
    computeReturnLatenessCharge({ status: 'INSPECCION', scheduledAt: SCHEDULED, receivedAt: at(min) }, at(2000), inputs)!;

  it.each([
    [30, 'NONE', null, null],
    [31, 'EXTRA_31_120', '50.00', '200.00'],
    [120, 'EXTRA_31_120', '50.00', '200.00'],
    [121, 'EXTRA_121_300', '100.00', '300.00'],
    [300, 'EXTRA_121_300', '100.00', '300.00'],
    [301, 'EXTRA_OVER_300', '200.00', '500.00'],
    [720, 'EXTRA_OVER_300', '200.00', '500.00'],
    [721, 'EXTRA_OVER_300', '200.00', '500.00'],
  ])('%i min -> %s', (min, tier, time, penalty) => {
    const c = charge(min);
    expect(c).toMatchObject({ tier, suggestedTimeCharge: time, suggestedGuaranteePenalty: penalty, informational: true });
  });

  it('bordes con segundos: 30:01 ya es primer tramo, 120:01 segundo, 300:01 tercero', () => {
    expect(latenessTierForDelta(30 * 60000)).toBe('NONE');
    expect(latenessTierForDelta(30 * 60000 + 1000)).toBe('EXTRA_31_120');
    expect(latenessTierForDelta(120 * 60000)).toBe('EXTRA_31_120');
    expect(latenessTierForDelta(120 * 60000 + 1000)).toBe('EXTRA_121_300');
    expect(latenessTierForDelta(300 * 60000 + 1000)).toBe('EXTRA_OVER_300');
  });

  it('severeBreach solo por encima de 12 h (720 min no, 721 sí)', () => {
    expect(charge(720).severeBreach).toBe(false);
    expect(charge(721).severeBreach).toBe(true);
    expect(charge(721).severeBreachThresholdHours).toBe(12);
  });

  it('sin garantía (p. ej. con conductor de la empresa): penalidad null, cargo por tiempo se mantiene', () => {
    expect(charge(60, { ...base, deposit: null, extensions: [] })).toMatchObject({
      suggestedTimeCharge: '50.00', suggestedGuaranteePenalty: null, guaranteeAmount: null, currency: null,
    });
    expect(charge(60, { dailyRate: 200, extensions: [] }).suggestedGuaranteePenalty).toBeNull();
  });

  it('sin tarifa diaria: cargo por tiempo null', () => {
    expect(charge(60, { ...base, dailyRate: null, extensions: [] })).toMatchObject({ suggestedTimeCharge: null, dailyRate: null });
  });

  it('aviso y pago previo: ampliación AUTORIZADA y pagada que cubre -> true y sin penalidad', () => {
    const ext = [{ status: 'AUTHORIZED', requestedEndAt: at(150), paymentId: 'pay-1' }];
    expect(charge(100, { ...base, extensions: ext })).toMatchObject({ noticeAndPrepaymentVerified: true, suggestedGuaranteePenalty: null, suggestedTimeCharge: '50.00' });
  });

  it('ampliación autorizada que NO cubre el tiempo, pendiente o rechazada -> false y penalidad condicional', () => {
    const short = [{ status: 'AUTHORIZED', requestedEndAt: at(60), paymentId: 'pay-1' }];
    expect(charge(100, { ...base, extensions: short })).toMatchObject({ noticeAndPrepaymentVerified: false, suggestedGuaranteePenalty: '200.00' });
    const pending = [{ status: 'PENDING', requestedEndAt: at(500), paymentId: null }];
    expect(charge(100, { ...base, extensions: pending }).noticeAndPrepaymentVerified).toBe(false);
  });

  it('autorizada que cubre pero sin pago ligado, o extensiones desconocidas -> null (lo confirma el operador)', () => {
    const unpaid = [{ status: 'AUTHORIZED', requestedEndAt: at(500), paymentId: null }];
    expect(charge(100, { ...base, extensions: unpaid })).toMatchObject({ noticeAndPrepaymentVerified: null, suggestedGuaranteePenalty: '200.00' });
    expect(charge(100, { ...base, extensions: undefined }).noticeAndPrepaymentVerified).toBeNull();
  });

  it('redondeo a centavos y sin retraso: todo null; CANCELADA sin recepción -> null; basis NOW sin recepción', () => {
    expect(charge(60, { dailyRate: 99.99, deposit: { originalAmount: 333.33, currency: 'PEN' }, extensions: [] })).toMatchObject({
      suggestedTimeCharge: '25.00', suggestedGuaranteePenalty: '66.67',
    });
    expect(charge(0)).toMatchObject({ tier: 'NONE', noticeAndPrepaymentVerified: null, severeBreach: false });
    expect(computeReturnLatenessCharge({ status: 'CANCELADA', scheduledAt: SCHEDULED, receivedAt: null }, at(500), base)).toBeNull();
    expect(computeReturnLatenessCharge({ status: 'PROGRAMADA', scheduledAt: SCHEDULED, receivedAt: null }, at(45), base)).toMatchObject({ basis: 'NOW', tier: 'EXTRA_31_120' });
  });
});
