/**
 * DEV-01 / BR-DEV-004 / DAT-DEV-001 - Recordatorio de devolución 3 horas antes de la hora pactada.
 * DEC-DEV-REMINDER-001: el envío por WhatsApp es MANUAL-ASISTIDO (la integración no existe): el sistema genera
 * el texto y deja el recordatorio PENDING; el operador registra el resultado (SENT | FAILED + nota).
 */
import { RETURN_LATE_TOLERANCE_MINUTES } from './return-lateness';
import { formatLimaDateTime as _limaFormatDateTime } from '../../../common/time/lima-time';

export type ReturnReminderStatus = 'PENDING' | 'SENT' | 'FAILED';
export const RETURN_REMINDER_STATUSES: readonly ReturnReminderStatus[] = ['PENDING', 'SENT', 'FAILED'];

/** Resultado que el operador puede registrar (PENDING no es un resultado). */
export type ReturnReminderResult = 'SENT' | 'FAILED';
export const RETURN_REMINDER_RESULTS: readonly ReturnReminderResult[] = ['SENT', 'FAILED'];

/** BR-DEV-004: el recordatorio corresponde 3 horas antes de la hora pactada. */
export const RETURN_REMINDER_LEAD_HOURS = 3;
export const RETURN_REMINDER_LEAD_MS = RETURN_REMINDER_LEAD_HOURS * 60 * 60 * 1000;

/**
 * No se generan recordatorios para devoluciones PROGRAMADA cuya hora pactada pasó hace más de 24 h (expedientes
 * huérfanos: evita un "backfill" masivo de mensajes obsoletos al desplegar). Conservador, ver DEC-DEV-REMINDER-001.
 */
export const RETURN_REMINDER_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Tolerancia BR-DEV-003/004 (30 min, CONFIRMADA): misma constante que el cálculo de retraso (return-lateness.ts). */
export const RETURN_REMINDER_TOLERANCE_MINUTES = RETURN_LATE_TOLERANCE_MINUTES;

/** dd/mm/yyyy y HH:mm de un instante, en hora de Lima (delega en lima-time.ts — DEC-TZ-LIMA-001). */
export function formatLimaDateTime(date: Date): { date: string; time: string } {
  const [d, t] = _limaFormatDateTime(date).split(' ');
  return { date: d, time: t };
}

/** Instante en que corresponde enviar el recordatorio. */
export function reminderDueAt(scheduledAt: Date): Date {
  return new Date(scheduledAt.getTime() - RETURN_REMINDER_LEAD_MS);
}

export interface ReminderTextInput {
  customerName: string | null;
  vehiclePlate: string | null;
  scheduledAt: Date;
}

/** Texto listo para copiar y pegar en WhatsApp (envío manual-asistido). */
export function buildReminderText(input: ReminderTextInput): string {
  const { date, time } = formatLimaDateTime(input.scheduledAt);
  const greeting = input.customerName ? `Hola ${input.customerName}` : 'Hola';
  const vehicle = input.vehiclePlate ? `del vehículo ${input.vehiclePlate} ` : 'del vehículo ';
  return (
    `${greeting}, le recordamos que la devolución ${vehicle}está programada para el ${date} a las ${time} (hora de Lima). ` +
    `Por favor confirme su asistencia respondiendo este mensaje; contamos con ${RETURN_REMINDER_TOLERANCE_MINUTES} minutos de tolerancia. ` +
    'Gracias, VeloxRent.'
  );
}

export interface ReminderCandidateWindow {
  /** Instante actual. */
  now: Date;
  /** Hora pactada máxima a considerar: now + 3 h. */
  scheduledUntil: Date;
  /** Hora pactada mínima a considerar: now - 24 h. */
  scheduledSince: Date;
}

export function reminderCandidateWindow(now: Date): ReminderCandidateWindow {
  return {
    now,
    scheduledUntil: new Date(now.getTime() + RETURN_REMINDER_LEAD_MS),
    scheduledSince: new Date(now.getTime() - RETURN_REMINDER_STALE_AFTER_MS),
  };
}
