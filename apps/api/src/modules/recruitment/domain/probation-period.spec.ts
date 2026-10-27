import { describe, it, expect } from '@jest/globals';
import { calculateProbationDaysRemaining, isProbationEndingSoon } from './probation-period';
import { limaDateStartToUtc } from '../../../common/time/lima-time';

describe('probation-period domain logic', () => {
  it('calcula 3 meses calendario desde la fecha de inicio', () => {
    // Inicio: 1 de agosto 2026. Fin de periodo de prueba: 1 de noviembre 2026.
    const startDate = '2026-08-01';
    
    // A 30 días de fin (2 de octubre 2026 00:00 Lima)
    const now30 = limaDateStartToUtc('2026-10-02');
    const days30 = calculateProbationDaysRemaining(startDate, now30);
    expect(days30).toBe(30);
    expect(isProbationEndingSoon(startDate, now30)).toBe(false);

    // A 15 días de fin (17 de octubre 2026 00:00 Lima)
    const now15 = limaDateStartToUtc('2026-10-17');
    const days15 = calculateProbationDaysRemaining(startDate, now15);
    expect(days15).toBe(15);
    expect(isProbationEndingSoon(startDate, now15)).toBe(true);

    // A 5 días de fin (27 de octubre 2026 00:00 Lima)
    const now5 = limaDateStartToUtc('2026-10-27');
    const days5 = calculateProbationDaysRemaining(startDate, now5);
    expect(days5).toBe(5);
    expect(isProbationEndingSoon(startDate, now5)).toBe(true);

    // Vencido (2 de noviembre 2026)
    const nowOver = limaDateStartToUtc('2026-11-02');
    const daysOver = calculateProbationDaysRemaining(startDate, nowOver);
    expect(daysOver).toBe(0);
    expect(isProbationEndingSoon(startDate, nowOver)).toBe(true);
  });

  it('soporta Date de Prisma (@db.Date)', () => {
    const startDate = new Date(Date.UTC(2026, 7, 1)); // 2026-08-01 UTC
    const now = limaDateStartToUtc('2026-10-20');
    expect(calculateProbationDaysRemaining(startDate, now)).toBe(12);
    expect(isProbationEndingSoon(startDate, now)).toBe(true);
  });
});
