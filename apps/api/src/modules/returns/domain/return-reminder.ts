/**
 * DEV-01 / BR-DEV-004 / DAT-DEV-001 - Recordatorio de devolución 3 horas antes de la hora pactada.
 * DEC-DEV-REMINDER-001: el envío por WhatsApp es MANUAL-ASISTIDO (la integración no existe): el sistema genera
 * el texto y deja el recordatorio PENDING; el operador registra el resultado (SENT | FAILED + nota).
 */
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

/** Tolerancia declarada por BR-DEV-004 (30 min); se informa en el texto, no bloquea nada. */
export const RETURN_REMINDER_TOLERANCE_MINUTES = 30;

/** DEC-TZ-BUSINESS-001: zona horaria de negocio America/Lima = UTC-5 fijo (sin horario de verano). */
export const BUSINESS_TIME_ZONE = 'America/Lima';
export const BUSINESS_UTC_OFFSET_HOURS = -5;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** dd/mm/yyyy y HH:mm de un instante, en hora de Lima. */
export function formatLimaDateTime(date: Date): { date: string; time: string } {
  const shifted = new Date(date.getTime() + BUSINESS_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    date: `${pad2(shifted.getUTCDate())}/${pad2(shifted.getUTCMonth() + 1)}/${shifted.getUTCFullYear()}`,
    time: `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`,
  };
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
