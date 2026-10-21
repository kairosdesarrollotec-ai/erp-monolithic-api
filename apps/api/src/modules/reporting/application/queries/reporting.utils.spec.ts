import { resolveReportPeriod, validateDateRange } from './reporting.utils';

/**
 * Filtros dateFrom/dateTo de Reportes (reporting 0.4.0, DEC-TZ-LIMA-001, BR-REP-005).
 * Lima = UTC-5 fijo: 00:00 Lima = 05:00Z; 23:59:59.999 Lima = 04:59:59.999Z del día siguiente.
 */
describe('resolveReportPeriod', () => {
  it('dateFrom date-only = 00:00 Lima y dateTo date-only = fin del día Lima (inclusivo)', () => {
    const p = resolveReportPeriod({ dateFrom: '2026-10-01', dateTo: '2026-10-11' });
    expect(p.dateFrom.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(p.dateTo.toISOString()).toBe('2026-10-12T04:59:59.999Z');
  });

  it('el último instante del día dateTo en Lima (23:59:59.999) queda dentro; el primero del día siguiente, fuera', () => {
    const p = resolveReportPeriod({ dateFrom: '2026-10-01', dateTo: '2026-10-11' });
    const lastMs = new Date('2026-10-12T04:59:59.999Z').getTime();
    const nextDay = new Date('2026-10-12T05:00:00.000Z').getTime();
    expect(lastMs).toBeLessThanOrEqual(p.dateTo.getTime());
    expect(nextDay).toBeGreaterThan(p.dateTo.getTime());
  });

  it('un evento a las 22:00 Lima del día dateTo (03:00Z del día siguiente en UTC) queda dentro', () => {
    const p = resolveReportPeriod({ dateFrom: '2026-10-11', dateTo: '2026-10-11' });
    const event = new Date('2026-10-12T03:00:00.000Z').getTime();
    expect(event).toBeGreaterThanOrEqual(p.dateFrom.getTime());
    expect(event).toBeLessThanOrEqual(p.dateTo.getTime());
  });

  it('un evento a las 23:00 Lima del día anterior a dateFrom queda fuera', () => {
    const p = resolveReportPeriod({ dateFrom: '2026-10-11', dateTo: '2026-10-11' });
    const event = new Date('2026-10-11T04:00:00.000Z').getTime(); // 10-10 23:00 Lima
    expect(event).toBeLessThan(p.dateFrom.getTime());
  });

  it('respeta un date-time con offset/Z tal cual (también en dateTo)', () => {
    const p = resolveReportPeriod({ dateFrom: '2026-10-01T10:00:00-05:00', dateTo: '2026-10-02T12:30:00Z' });
    expect(p.dateFrom.toISOString()).toBe('2026-10-01T15:00:00.000Z');
    expect(p.dateTo.toISOString()).toBe('2026-10-02T12:30:00.000Z');
  });

  it('sin filtros = hoy en Lima (de 00:00 a 23:59:59.999 Lima), aunque en UTC ya sea otro día', () => {
    // 2026-10-16T02:00Z = 2026-10-15 21:00 Lima
    const p = resolveReportPeriod({}, new Date('2026-10-16T02:00:00.000Z'));
    expect(p.dateFrom.toISOString()).toBe('2026-10-15T05:00:00.000Z');
    expect(p.dateTo.toISOString()).toBe('2026-10-16T04:59:59.999Z');
  });

  it('solo dateFrom: dateTo = hoy (Lima)', () => {
    const p = resolveReportPeriod({ dateFrom: '2026-10-10' }, new Date('2026-10-16T15:00:00.000Z'));
    expect(p.dateFrom.toISOString()).toBe('2026-10-10T05:00:00.000Z');
    expect(p.dateTo.toISOString()).toBe('2026-10-17T04:59:59.999Z');
  });

  it('solo dateTo: dateFrom = inicio de ese mismo día en Lima', () => {
    const p = resolveReportPeriod({ dateTo: '2026-10-05' });
    expect(p.dateFrom.toISOString()).toBe('2026-10-05T05:00:00.000Z');
    expect(p.dateTo.toISOString()).toBe('2026-10-06T04:59:59.999Z');
  });

  it.each(['2026-02-30', '2026-13-01', 'no-es-fecha'])('rechaza dateFrom inválido (%s) con INVALID_DATE 400', (bad) => {
    expect(() => resolveReportPeriod({ dateFrom: bad, dateTo: '2026-10-11' })).toThrow(
      expect.objectContaining({ code: 'INVALID_DATE', httpStatus: 400 }),
    );
  });

  it('rechaza dateTo inválido con INVALID_DATE 400', () => {
    expect(() => resolveReportPeriod({ dateFrom: '2026-10-01', dateTo: '2026-02-30' })).toThrow(
      expect.objectContaining({ code: 'INVALID_DATE', httpStatus: 400 }),
    );
  });
});

describe('validateDateRange (BR-REP-005)', () => {
  function period(from: string, to: string) {
    return resolveReportPeriod({ dateFrom: from, dateTo: to });
  }

  it('acepta el mismo día (0 días)', () => {
    const { dateFrom, dateTo } = period('2026-10-11', '2026-10-11');
    expect(() => validateDateRange(dateFrom, dateTo)).not.toThrow();
  });

  it('acepta exactamente 90 días calendario inclusivos (dateTo - dateFrom = 89, límite)', () => {
    const { dateFrom, dateTo } = period('2026-01-01', '2026-03-31'); // 90 días inclusivos
    expect(() => validateDateRange(dateFrom, dateTo)).not.toThrow();
  });

  it('rechaza 91 días inclusivos (diferencia 90) con RANGE_EXCEEDS_MAX 400', () => {
    const { dateFrom, dateTo } = period('2026-01-01', '2026-04-01'); // 91 días inclusivos
    expect(() => validateDateRange(dateFrom, dateTo)).toThrow(
      expect.objectContaining({ code: 'RANGE_EXCEEDS_MAX', httpStatus: 400 }),
    );
  });

  it('el límite se mide en días calendario de Lima, no en horas (dateTo con fin de día no suma un día)', () => {
    const { dateFrom, dateTo } = period('2026-07-01', '2026-09-28'); // 90 días inclusivos; dateTo-dateFrom = 89d 23h59m
    expect(dateTo.getTime() - dateFrom.getTime()).toBeGreaterThan(89 * 24 * 3600 * 1000);
    expect(() => validateDateRange(dateFrom, dateTo)).not.toThrow();
  });

  it('rechaza dateFrom posterior a dateTo con INVALID_DATE_RANGE 400', () => {
    const dateFrom = new Date('2026-10-12T05:00:00.000Z');
    const dateTo = new Date('2026-10-11T04:59:59.999Z');
    expect(() => validateDateRange(dateFrom, dateTo)).toThrow(
      expect.objectContaining({ code: 'INVALID_DATE_RANGE', httpStatus: 400 }),
    );
  });

  it('rechaza Invalid Date con INVALID_DATE 400', () => {
    expect(() => validateDateRange(new Date(Number.NaN), new Date())).toThrow(
      expect.objectContaining({ code: 'INVALID_DATE', httpStatus: 400 }),
    );
  });
});
