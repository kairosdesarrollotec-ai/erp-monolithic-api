import {
  calendarDateToLimaStart,
  formatLimaDMY,
  formatLimaDateTime,
  limaDateEndToUtc,
  limaDateStartToUtc,
  limaNextDayStartToUtc,
  parseBusinessInstant,
  parseLimaLocalDateTime,
  toLimaLocalDateTimeString,
  toLimaDateString,
} from './lima-time';

describe('lima-time (DEC-TZ-LIMA-001)', () => {
  it('limaDateStartToUtc: medianoche de Lima = 05:00Z', () => {
    expect(limaDateStartToUtc('2026-10-20').toISOString()).toBe('2026-10-20T05:00:00.000Z');
  });

  it('limaDateEndToUtc: 23:59:59.999 Lima = 04:59:59.999Z del dia siguiente', () => {
    expect(limaDateEndToUtc('2026-10-20').toISOString()).toBe('2026-10-21T04:59:59.999Z');
    expect(limaNextDayStartToUtc('2026-12-31').toISOString()).toBe('2027-01-01T05:00:00.000Z');
  });

  it('rechaza fechas invalidas o inexistentes', () => {
    expect(() => limaDateStartToUtc('2026-13-01')).toThrow(RangeError);
    expect(() => limaDateStartToUtc('2026-02-30')).toThrow(RangeError);
    expect(() => limaDateStartToUtc('20/10/2026')).toThrow(RangeError);
  });

  it('toLimaDateString: bordes del dia (22:00-23:59 Lima cruzan el dia UTC)', () => {
    // 22:00 Lima del 20 = 03:00Z del 21 -> sigue siendo 20 en Lima.
    expect(toLimaDateString(new Date('2026-10-21T03:00:00.000Z'))).toBe('2026-10-20');
    // 23:59 Lima del 20 = 04:59Z del 21.
    expect(toLimaDateString(new Date('2026-10-21T04:59:59.999Z'))).toBe('2026-10-20');
    // 00:00 Lima del 21 = 05:00Z.
    expect(toLimaDateString(new Date('2026-10-21T05:00:00.000Z'))).toBe('2026-10-21');
    // 00:00Z del 21 son las 19:00 del 20 en Lima.
    expect(toLimaDateString(new Date('2026-10-21T00:00:00.000Z'))).toBe('2026-10-20');
  });

  it('ida y vuelta: toLimaDateString(limaDateStartToUtc(d)) === d (incluye fin de anio y bisiesto)', () => {
    for (const d of ['2026-01-01', '2026-12-31', '2028-02-29', '2026-03-01']) {
      expect(toLimaDateString(limaDateStartToUtc(d))).toBe(d);
      expect(toLimaDateString(limaDateEndToUtc(d))).toBe(d);
    }
  });

  it('parseBusinessInstant: date-only -> Lima; date-time se respeta', () => {
    expect(parseBusinessInstant('2026-10-20').toISOString()).toBe('2026-10-20T05:00:00.000Z');
    expect(parseBusinessInstant('2026-10-20T10:00:00.000Z').toISOString()).toBe('2026-10-20T10:00:00.000Z');
    expect(parseBusinessInstant('2026-10-20T10:00:00-05:00').toISOString()).toBe('2026-10-20T15:00:00.000Z');
    expect(Number.isNaN(parseBusinessInstant('2026-02-30').getTime())).toBe(true);
    expect(Number.isNaN(parseBusinessInstant('basura').getTime())).toBe(true);
  });

  it('calendarDateToLimaStart: @db.Date (medianoche UTC) -> inicio del dia en Lima', () => {
    expect(calendarDateToLimaStart(new Date('2026-10-20T00:00:00.000Z')).toISOString()).toBe('2026-10-20T05:00:00.000Z');
  });

  it('formatLimaDMY no lanza con fechas invalidas', () => {
    expect(formatLimaDMY(new Date(Number.NaN))).toBe('Invalid Date');
  });

  it('formatea en hora de Lima', () => {
    expect(formatLimaDMY(new Date('2026-10-21T03:00:00.000Z'))).toBe('20/10/2026');
    expect(formatLimaDateTime(new Date('2026-10-21T03:05:00.000Z'))).toBe('20/10/2026 22:05');
    expect(formatLimaDateTime(new Date('2026-10-20T05:00:00.000Z'))).toBe('20/10/2026 00:00');
  });

  it('parseLimaLocalDateTime: sin offset = hora de Lima; con offset se respeta', () => {
    expect(parseLimaLocalDateTime('2026-10-20T08:15').toISOString()).toBe('2026-10-20T13:15:00.000Z');
    // 22:30 Lima del 20 ya es el 21 en UTC.
    expect(parseLimaLocalDateTime('2026-10-20T22:30:10').toISOString()).toBe('2026-10-21T03:30:10.000Z');
    expect(parseLimaLocalDateTime('2026-10-20 23:59').toISOString()).toBe('2026-10-21T04:59:00.000Z');
    expect(parseLimaLocalDateTime('2026-10-20T08:15:00Z').toISOString()).toBe('2026-10-20T08:15:00.000Z');
    expect(Number.isNaN(parseLimaLocalDateTime('2026-10-20T25:00').getTime())).toBe(true);
    expect(Number.isNaN(parseLimaLocalDateTime('2026-02-30T10:00').getTime())).toBe(true);
  });

  it('toLimaLocalDateTimeString es inversa de parseLimaLocalDateTime', () => {
    expect(toLimaLocalDateTimeString(new Date('2026-10-21T03:30:10.000Z'))).toBe('2026-10-20T22:30:10');
    expect(toLimaLocalDateTimeString(parseLimaLocalDateTime('2026-10-20T00:00:00'))).toBe('2026-10-20T00:00:00');
  });
});
