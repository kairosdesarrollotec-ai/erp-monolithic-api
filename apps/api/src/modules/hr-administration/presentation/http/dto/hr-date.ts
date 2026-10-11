/**
 * Fecha calendario "YYYY-MM-DD" (format: date del contrato) -> Date a medianoche UTC, que es como
 * Prisma guarda las columnas @db.Date.
 */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
