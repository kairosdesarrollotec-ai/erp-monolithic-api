/**
 * Respuesta de Fiorella (16-oct-2026): el servicio de conductor de la EMPRESA se cobra por TARIFA DIARIA
 * (monto por dia x dias del alquiler), sin garantia (DEC-ALQ-COMPANY-DRIVER-004).
 * No existe tabla de cargos ni el monto de la tarifa: se calcula como vista (no se persiste) y la tarifa es un
 * parametro (`COMPANY_DRIVER_DAILY_RATE`, `COMPANY_DRIVER_DAILY_RATE_CURRENCY`). Sin tarifa -> configured=false.
 */
export interface CompanyDriverCharge {
  configured: boolean;
  /** Monto por dia ("0.00" si no esta configurado). */
  dailyRate: string;
  currency: string;
  days: number;
  /** dailyRate x days ("0.00" si no esta configurado). */
  total: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dias facturables: dias calendario completos entre inicio y fin, redondeando hacia arriba, minimo 1. */
export function rentalBillableDays(startAt: Date | null, endAt: Date | null): number {
  if (!startAt || !endAt) return 0;
  const ms = endAt.getTime() - startAt.getTime();
  if (!(ms > 0)) return 1;
  return Math.ceil(ms / DAY_MS);
}

export function computeCompanyDriverCharge(input: {
  dailyRate: string | null | undefined;
  currency?: string | null;
  startAt: Date | null;
  expectedEndAt: Date | null;
}): CompanyDriverCharge {
  const days = rentalBillableDays(input.startAt, input.expectedEndAt);
  const currency = input.currency === 'USD' ? 'USD' : 'PEN';
  const rate = input.dailyRate?.trim();
  const cents = rate && /^\d+(\.\d{1,2})?$/.test(rate) ? Math.round(parseFloat(rate) * 100) : NaN;
  if (!Number.isFinite(cents) || cents <= 0) {
    return { configured: false, dailyRate: '0.00', currency, days, total: '0.00' };
  }
  const fmt = (c: number) => (c / 100).toFixed(2);
  return { configured: true, dailyRate: fmt(cents), currency, days, total: fmt(cents * days) };
}
