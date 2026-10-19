/**
 * Respuesta de Fiorella (16-oct-2026): el servicio de conductor de la EMPRESA se cobra por TARIFA DIARIA
 * (monto por dia x dias del alquiler), sin garantia (DEC-ALQ-COMPANY-DRIVER-004).
 * No existe tabla de cargos: se calcula como vista (no se persiste el total).
 * Respuesta de Russbel (19-oct-2026): la tarifa aun no existe y "se puede rellenar manualmente cuando se requiera"
 * (DEC-ALQ-DRIVERRATE-001). Prioridad de la tarifa diaria:
 *   1) valor manual del alquiler (`rentals.company_driver_daily_rate`)            -> source MANUAL
 *   2) env `COMPANY_DRIVER_DAILY_RATE` (+ `COMPANY_DRIVER_DAILY_RATE_CURRENCY`)    -> source ENV
 *   3) ninguno                                                                      -> source NOT_DEFINED (configured=false, "0.00";
 *      el cobro queda PENDIENTE de digitar; nunca se inventa un monto).
 * El valor manual siempre es en PEN (la moneda del env solo aplica al valor de entorno).
 */
export type CompanyDriverRateSource = 'MANUAL' | 'ENV' | 'NOT_DEFINED';

export interface CompanyDriverCharge {
  /** true = hay tarifa (manual o de entorno); false = NOT_DEFINED. */
  configured: boolean;
  /** Origen de la tarifa diaria aplicada. */
  source: CompanyDriverRateSource;
  /** Monto por dia ("0.00" si no esta definido). */
  dailyRate: string;
  currency: string;
  days: number;
  /** dailyRate x days ("0.00" si no esta definido). */
  total: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** DECIMAL(10,2): maximo 8 enteros + 2 decimales. */
const RATE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

/** Dias facturables: dias calendario completos entre inicio y fin, redondeando hacia arriba, minimo 1. */
export function rentalBillableDays(startAt: Date | null, endAt: Date | null): number {
  if (!startAt || !endAt) return 0;
  const ms = endAt.getTime() - startAt.getTime();
  if (!(ms > 0)) return 1;
  return Math.ceil(ms / DAY_MS);
}

/** Centimos de una tarifa valida (> 0, <= 2 decimales, cabe en DECIMAL(10,2)); NaN si no es valida. */
function rateToCents(rate: string | null | undefined): number {
  const value = rate?.trim();
  if (!value || !RATE_PATTERN.test(value)) return NaN;
  const cents = Math.round(parseFloat(value) * 100);
  return cents > 0 ? cents : NaN;
}

/**
 * Normaliza la tarifa diaria digitada a mano ("80" -> "80.00"). Devuelve null si no es un monto > 0 con a lo sumo
 * 2 decimales (o no cabe en DECIMAL(10,2)).
 */
export function normalizeManualDailyRate(rate: string | null | undefined): string | null {
  const cents = rateToCents(rate);
  return Number.isFinite(cents) ? (cents / 100).toFixed(2) : null;
}

export function computeCompanyDriverCharge(input: {
  /** Tarifa de entorno (`COMPANY_DRIVER_DAILY_RATE`). */
  dailyRate: string | null | undefined;
  currency?: string | null;
  /** DEC-ALQ-DRIVERRATE-001: tarifa digitada a mano en el alquiler; tiene prioridad sobre el entorno. */
  manualDailyRate?: string | null;
  startAt: Date | null;
  expectedEndAt: Date | null;
}): CompanyDriverCharge {
  const days = rentalBillableDays(input.startAt, input.expectedEndAt);
  const fmt = (c: number) => (c / 100).toFixed(2);

  const manualCents = rateToCents(input.manualDailyRate);
  if (Number.isFinite(manualCents)) {
    return { configured: true, source: 'MANUAL', dailyRate: fmt(manualCents), currency: 'PEN', days, total: fmt(manualCents * days) };
  }

  const currency = input.currency === 'USD' ? 'USD' : 'PEN';
  const envCents = rateToCents(input.dailyRate);
  if (!Number.isFinite(envCents)) {
    return { configured: false, source: 'NOT_DEFINED', dailyRate: '0.00', currency, days, total: '0.00' };
  }
  return { configured: true, source: 'ENV', dailyRate: fmt(envCents), currency, days, total: fmt(envCents * days) };
}
