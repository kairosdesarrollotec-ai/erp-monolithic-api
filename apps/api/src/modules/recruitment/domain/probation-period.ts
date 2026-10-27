import { calendarDateToString, limaDateStartToUtc } from '../../../common/time/lima-time';

/**
 * BR-REC-005 / REC-08: El periodo de prueba dura 3 meses calendario desde la fecha de inicio.
 * La alerta se debe emitir cuando faltan 15 días o menos para cumplir los 3 meses.
 * Devuelve la cantidad de días restantes (0 si ya se cumplieron o vencieron).
 */
export function calculateProbationDaysRemaining(startDate: Date | string, now: Date = new Date()): number {
  const dateStr = typeof startDate === 'string' ? startDate : calendarDateToString(startDate);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return 0;

  // Fin del periodo de prueba: 3 meses calendario después, a las 00:00 de Lima.
  const endDay = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + 3, Number(match[3])));
  const endDate = `${endDay.getUTCFullYear()}-${String(endDay.getUTCMonth() + 1).padStart(2, '0')}-${String(endDay.getUTCDate()).padStart(2, '0')}`;
  const end = limaDateStartToUtc(endDate);

  const diff = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  return Math.max(0, diff);
}

/**
 * Determina si corresponde emitir la alerta de fin de periodo de prueba:
 * falta 15 días o menos para cumplir los 3 meses (días <= 15).
 */
export function isProbationEndingSoon(startDate: Date | string, now: Date = new Date()): boolean {
  const days = calculateProbationDaysRemaining(startDate, now);
  return days <= 15;
}
