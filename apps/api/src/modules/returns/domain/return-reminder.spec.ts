import {
  buildReminderText,
  formatLimaDateTime,
  reminderCandidateWindow,
  reminderDueAt,
  RETURN_REMINDER_LEAD_MS,
} from './return-reminder';

describe('Recordatorio de devolución (BR-DEV-004, DEC-DEV-REMINDER-001)', () => {
  it('formatea en hora de Lima (UTC-5): 2026-10-05T15:00Z -> 05/10/2026 10:00', () => {
    expect(formatLimaDateTime(new Date('2026-10-05T15:00:00.000Z'))).toEqual({ date: '05/10/2026', time: '10:00' });
  });

  it('cruza de día correctamente: 2026-10-06T03:30Z -> 05/10/2026 22:30 (Lima)', () => {
    expect(formatLimaDateTime(new Date('2026-10-06T03:30:00.000Z'))).toEqual({ date: '05/10/2026', time: '22:30' });
  });

  it('cruza de año: 2027-01-01T02:00Z -> 31/12/2026 21:00 (Lima)', () => {
    expect(formatLimaDateTime(new Date('2027-01-01T02:00:00.000Z'))).toEqual({ date: '31/12/2026', time: '21:00' });
  });

  it('vence 3 horas antes de la hora pactada', () => {
    const scheduledAt = new Date('2026-10-05T15:00:00.000Z');
    expect(reminderDueAt(scheduledAt).toISOString()).toBe('2026-10-05T12:00:00.000Z');
    expect(RETURN_REMINDER_LEAD_MS).toBe(3 * 60 * 60 * 1000);
  });

  it('el texto incluye cliente, placa, fecha y hora de Lima, y la tolerancia de 30 min', () => {
    const text = buildReminderText({
      customerName: 'Juan Perez',
      vehiclePlate: 'ABC-123',
      scheduledAt: new Date('2026-10-05T15:00:00.000Z'),
    });
    expect(text).toContain('Hola Juan Perez');
    expect(text).toContain('ABC-123');
    expect(text).toContain('05/10/2026 a las 10:00 (hora de Lima)');
    expect(text).toContain('30 minutos de tolerancia');
  });

  it('el texto tolera cliente y placa desconocidos', () => {
    const text = buildReminderText({ customerName: null, vehiclePlate: null, scheduledAt: new Date('2026-10-05T15:00:00.000Z') });
    expect(text.startsWith('Hola, le recordamos')).toBe(true);
    expect(text).toContain('del vehículo está programada');
  });

  it('ventana de candidatos: hora pactada entre now-24h (descarta huérfanas) y now+3h', () => {
    const now = new Date('2026-10-05T12:00:00.000Z');
    const window = reminderCandidateWindow(now);
    expect(window.scheduledUntil.toISOString()).toBe('2026-10-05T15:00:00.000Z');
    expect(window.scheduledSince.toISOString()).toBe('2026-10-04T12:00:00.000Z');
  });
});
