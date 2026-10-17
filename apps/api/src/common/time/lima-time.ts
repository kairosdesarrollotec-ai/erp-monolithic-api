/**
 * DEC-TZ-LIMA-001 - Zona horaria de negocio: America/Lima (UTC-5 fijo, Peru no usa DST).
 *
 * Las fechas "date-only" (YYYY-MM-DD) de viaje/alquiler/reserva se interpretan como
 * calendario de Lima: el dia D comienza en D 00:00 America/Lima = D 05:00Z y termina
 * en D 23:59:59.999 Lima = (D+1) 04:59:59.999Z.
 *
 * Las columnas `@db.Date` (fechas calendario puras) siguen guardandose como medianoche
 * UTC por Prisma; ese es el almacenamiento del calendario, NO un instante. Para
 * convertirlas a instante usar `calendarDateToLimaStart`.
 */
export const LIMA_TIME_ZONE = 'America/Lima';
export const LIMA_UTC_OFFSET_HOURS = -5;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LIMA_OFFSET_MS = LIMA_UTC_OFFSET_HOURS * HOUR_MS;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateOnlyString(value: string): boolean {
  return DATE_ONLY.test(value);
}

function parseDateOnlyParts(value: string): { y: number; m: number; d: number } {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new RangeError(`Fecha date-only invalida (se esperaba YYYY-MM-DD): ${value}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new RangeError(`Fecha date-only inexistente: ${value}`);
  }
  return { y, m, d };
}

/** Inicio (00:00:00.000 Lima) del dia `YYYY-MM-DD`, como instante UTC. */
export function limaDateStartToUtc(dateOnly: string): Date {
  const { y, m, d } = parseDateOnlyParts(dateOnly);
  return new Date(Date.UTC(y, m - 1, d) - LIMA_OFFSET_MS);
}

/** Ultimo milisegundo (23:59:59.999 Lima) del dia `YYYY-MM-DD`, como instante UTC. */
export function limaDateEndToUtc(dateOnly: string): Date {
  return new Date(limaDateStartToUtc(dateOnly).getTime() + DAY_MS - 1);
}

/** Inicio del dia siguiente en Lima (limite exclusivo de ventanas [from, to)). */
export function limaNextDayStartToUtc(dateOnly: string): Date {
  return new Date(limaDateStartToUtc(dateOnly).getTime() + DAY_MS);
}

/** Dia calendario de Lima (`YYYY-MM-DD`) al que pertenece un instante. */
export function toLimaDateString(instant: Date): string {
  const shifted = new Date(instant.getTime() + LIMA_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` de una columna `@db.Date` (medianoche UTC = fecha calendario). */
export function calendarDateToString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Convierte una fecha calendario `@db.Date` en el instante de inicio de ese dia en Lima. */
export function calendarDateToLimaStart(value: Date): Date {
  return limaDateStartToUtc(calendarDateToString(value));
}

/**
 * Parsea un valor del contrato HTTP: `YYYY-MM-DD` -> inicio del dia en Lima; cualquier otro
 * ISO 8601 (con hora/offset) -> el instante tal cual. Devuelve Invalid Date si no parsea.
 */
export function parseBusinessInstant(value: string): Date {
  if (isDateOnlyString(value)) {
    try {
      return limaDateStartToUtc(value);
    } catch {
      return new Date(Number.NaN);
    }
  }
  return new Date(value);
}

/** dd/mm/yyyy segun el calendario de Lima. */
export function formatLimaDMY(instant: Date): string {
  if (Number.isNaN(instant.getTime())) return 'Invalid Date';
  const [y, m, d] = toLimaDateString(instant).split('-');
  return `${d}/${m}/${y}`;
}

/** dd/mm/yyyy HH:mm (hora de Lima, 24h). */
export function formatLimaDateTime(instant: Date): string {
  const shifted = new Date(instant.getTime() + LIMA_OFFSET_MS);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${formatLimaDMY(instant)} ${hh}:${mm}`;
}

/** Dia calendario de Lima "hoy" para el reloj dado. */
export function limaTodayString(now: Date = new Date()): string {
  return toLimaDateString(now);
}

const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

/**
 * Parsea un date-time "local de Lima" sin offset (`YYYY-MM-DDTHH:mm[:ss[.SSS]]`) como hora de
 * America/Lima; si trae `Z` u offset explicito se respeta. Invalid Date si no parsea.
 */
export function parseLimaLocalDateTime(value: string): Date {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return new Date(value);
  const [, date, hh, mm, ss = '00', ms = '0'] = match;
  if (Number(hh) > 23 || Number(mm) > 59 || Number(ss) > 59) return new Date(Number.NaN);
  try {
    return new Date(limaDateStartToUtc(date).getTime() + ((Number(hh) * 60 + Number(mm)) * 60 + Number(ss)) * 1000 + Number(ms.padEnd(3, '0')));
  } catch {
    return new Date(Number.NaN);
  }
}

/** `YYYY-MM-DDTHH:mm:ss` en hora de Lima, sin offset. */
export function toLimaLocalDateTimeString(instant: Date): string {
  return new Date(instant.getTime() + LIMA_OFFSET_MS).toISOString().slice(0, 19);
}
