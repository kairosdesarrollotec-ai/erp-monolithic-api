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
export function calculateFuelPenalty(fuelLevel: ReturnFuelLevel): number {
  const linePrice = getCosmeticDamageRate('COMBUSTIBLE_POR_LINEA') ?? 50.0;
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
