import { DomainBadRequestError } from '../../../../common/domain/domain-errors';
import {
  isDateOnlyString,
  limaDateEndToUtc,
  limaDateStartToUtc,
  limaTodayString,
  parseBusinessInstant,
  toLimaDateString,
} from '../../../../common/time/lima-time';

export const MAX_RANGE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fecha ausente o ilegible (p. ej. `2026-02-30`). */
export class ReportInvalidDateError extends DomainBadRequestError {
  readonly code = 'INVALID_DATE';
}

/** `dateFrom` posterior a `dateTo`. */
export class ReportInvalidDateRangeError extends DomainBadRequestError {
  readonly code = 'INVALID_DATE_RANGE';
}

/** Rango mayor a 90 días calendario inclusivos (BR-REP-005; dateTo - dateFrom <= 89). */
export class ReportRangeExceedsMaxError extends DomainBadRequestError {
  readonly code = 'RANGE_EXCEEDS_MAX';
}

/** Dias calendario de Lima entre dos instantes (to - from). */
function limaCalendarDaysBetween(from: Date, to: Date): number {
  const a = Date.parse(`${toLimaDateString(from)}T00:00:00Z`);
  const b = Date.parse(`${toLimaDateString(to)}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

/**
 * BR-REP-005: el rango máximo para reportes financieros y exportación es 90 días calendario INCLUSIVOS
 * (confirmado por negocio 16-oct-2026): `dateTo - dateFrom <= 89` días.
 * El rango se mide en días calendario de America/Lima (DEC-TZ-LIMA-001): `dateFrom` y `dateTo` del
 * mismo día = 0 días (1 día); `dateTo` = `dateFrom` + 89 días (90 días inclusivos) es el máximo aceptado.
 * Errores (400, `{statusCode, code, detail}`): INVALID_DATE, INVALID_DATE_RANGE, RANGE_EXCEEDS_MAX.
 */
export function validateDateRange(from: Date, to: Date): void {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ReportInvalidDateError('dateFrom y dateTo deben ser fechas válidas (YYYY-MM-DD).');
  }
  if (to.getTime() < from.getTime()) {
    throw new ReportInvalidDateRangeError('dateFrom debe ser anterior o igual a dateTo.');
  }
  if (limaCalendarDaysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
    throw new ReportRangeExceedsMaxError(
      `El rango de fechas no puede superar ${MAX_RANGE_DAYS} días calendario inclusivos (BR-REP-005).`,
    );
  }
}

export interface ReportPeriodInput {
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportPeriod {
  /** Instante de inicio (inclusive). */
  dateFrom: Date;
  /** Instante de fin (inclusive). */
  dateTo: Date;
}

/**
 * Convierte los filtros `dateFrom`/`dateTo` del contrato HTTP en un período de instantes
 * (DEC-TZ-LIMA-001, reporting 0.4.0):
 *  - `YYYY-MM-DD` en `dateFrom` = 00:00:00.000 America/Lima de ese día (inclusive).
 *  - `YYYY-MM-DD` en `dateTo` = 23:59:59.999 America/Lima de ese día: el día `dateTo` se incluye completo.
 *  - Un date-time con offset/Z se respeta tal cual.
 *  - Sin `dateTo` = hoy (Lima). Sin `dateFrom` (sólo en KPIs operativos) = el día de `dateTo`
 *    (si ambos faltan, hoy).
 * Lanza INVALID_DATE si algún valor no se puede interpretar.
 */
export function resolveReportPeriod(input: ReportPeriodInput, now: Date = new Date()): ReportPeriod {
  const today = limaTodayString(now);

  const toRaw = input.dateTo ?? today;
  const dateTo = parseBusinessInstant(toRaw);
  if (Number.isNaN(dateTo.getTime())) {
    throw new ReportInvalidDateError('dateTo debe ser una fecha válida (YYYY-MM-DD).');
  }
  const dateToInclusive = isDateOnlyString(toRaw) ? limaDateEndToUtc(toRaw) : dateTo;

  let dateFrom: Date;
  if (input.dateFrom !== undefined) {
    dateFrom = parseBusinessInstant(input.dateFrom);
    if (Number.isNaN(dateFrom.getTime())) {
      throw new ReportInvalidDateError('dateFrom debe ser una fecha válida (YYYY-MM-DD).');
    }
  } else {
    dateFrom = limaDateStartToUtc(toLimaDateString(dateToInclusive));
  }

  return { dateFrom, dateTo: dateToInclusive };
}
