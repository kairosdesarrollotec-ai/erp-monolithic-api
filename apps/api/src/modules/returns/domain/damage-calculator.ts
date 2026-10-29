import { ReturnFuelLevel } from './return-status';
import { getCosmeticDamageRate } from './cosmetic-damage-rate';

export interface ImmobilizationCalculationResult {
  readonly eligible: boolean;
  readonly hoursElapsed: number;
  readonly daysCharged: number;
  readonly totalAmount: number;
}

/**
 * BR-DEV-011: Si el vehículo queda paralizado más allá de las 24h naturales
 * desde la recepción sin respuesta del cliente al informe de daño técnico de Motrix,
 * esos días de paralización se cobran al cliente como días de alquiler adicionales
 * (dailyRate contractual).
 */
export function calculateImmobilizationCharge(
  receivedAt: Date,
  assessmentOrCurrentDate: Date,
  dailyRate: number,
): ImmobilizationCalculationResult {
  const diffMs = assessmentOrCurrentDate.getTime() - receivedAt.getTime();
  const hoursElapsed = diffMs / (1000 * 60 * 60);

  if (hoursElapsed <= 24) {
    return {
      eligible: false,
      hoursElapsed,
      daysCharged: 0,
      totalAmount: 0,
    };
  }

  // Días transcurridos después del período de gracia de 24h
  const excessHours = hoursElapsed - 24;
  const daysCharged = Math.ceil(excessHours / 24);
  const totalAmount = daysCharged * dailyRate;

  return {
    eligible: true,
    hoursElapsed,
    daysCharged,
    totalAmount,
  };
}

/**
 * BDD-04-devolucion seccion 9.6.1: Llenado de combustible por línea S/ 50.00
 * Se asume un tanque estándar de 4 cuartos (4 líneas):
 * FULL: 0 líneas faltantes
 * THREE_QUARTERS: 1 línea faltante (S/ 50.00)
 * HALF: 2 líneas faltantes (S/ 100.00)
 * ONE_QUARTER: 3 líneas faltantes (S/ 150.00)
 * EMPTY: 4 líneas faltantes (S/ 200.00)
 */
export function calculateFuelPenalty(
  fuelLevel: ReturnFuelLevel,
  customPenaltyPerLine?: number | null,
): number {
  const linePrice =
    customPenaltyPerLine && customPenaltyPerLine > 0
      ? customPenaltyPerLine
      : (getCosmeticDamageRate('COMBUSTIBLE_POR_LINEA') ?? 50.0);
  switch (fuelLevel) {
    case 'FULL':
      return 0;
    case 'THREE_QUARTERS':
      return 1 * linePrice;
    case 'HALF':
      return 2 * linePrice;
    case 'ONE_QUARTER':
      return 3 * linePrice;
    case 'EMPTY':
      return 4 * linePrice;
    default:
      return 0;
  }
}

/**
 * Decisión de negocio 28-oct #1 (H-06): la multa de combustible compara lo entregado con lo recibido, en líneas del RNC
 * (Formato 06, 0 a 16). Monto = líneas faltantes x precio por línea fijado en Flota para ese vehículo. Devuelve null si falta
 * alguna lectura o el vehículo no tiene precio por línea, para que el llamador use el cálculo anterior por nivel de recepción.
 */
export function calculateFuelPenaltyByLines(
  deliveryLines: number | null | undefined,
  returnLines: number | null | undefined,
  pricePerLine: number | null | undefined,
): number | null {
  if (deliveryLines == null || returnLines == null || !pricePerLine || pricePerLine <= 0) return null;
  const missing = Math.max(0, deliveryLines - returnLines);
  return Math.round(missing * pricePerLine * 100) / 100;
}
