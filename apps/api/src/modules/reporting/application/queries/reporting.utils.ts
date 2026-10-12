import { BadRequestException } from '@nestjs/common';

const MAX_RANGE_DAYS = 90;

/**
 * BR-REP-005: el rango de fechas máximo para reportes financieros y exportación es 90 días calendario.
 * Lanza BadRequestException con código RANGE_EXCEEDS_MAX si se supera.
 */
export function validateDateRange(from: Date, to: Date): void {
  const diffMs = to.getTime() - from.getTime();
  if (diffMs < 0) {
    throw new BadRequestException({ code: 'INVALID_DATE_RANGE', message: 'dateFrom debe ser anterior o igual a dateTo.' });
  }
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > MAX_RANGE_DAYS) {
    throw new BadRequestException({
      code: 'RANGE_EXCEEDS_MAX',
      message: `El rango de fechas no puede superar ${MAX_RANGE_DAYS} días calendario (BR-REP-005).`,
    });
  }
}
