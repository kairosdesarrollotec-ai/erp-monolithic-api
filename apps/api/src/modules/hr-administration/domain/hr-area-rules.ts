/**
 * H-02 / DEC-ADP-AREAS-001..003: normalizacion de areas de RR.HH. Es la MISMA regla que usa el front (`areaIdFromName`) para
 * derivar el id de un area nueva, de modo que "Operaciones", "OPERACIONES " y "operaciónes" no partan el cupo de vacaciones
 * del area (BR-ADP-002, que compara `areaId` por igualdad).
 */

/** Texto del area sin tildes ni mayusculas, solo [A-Z0-9] separados por un espacio. Sirve para comparar nombres. */
export function normalizeAreaText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** Codigo estable derivado del texto (mayusculas, sin tildes, `_`). Idempotente sobre un codigo ya canonico. */
export function areaCodeFromText(value: string): string {
  return normalizeAreaText(value).replace(/ /g, '_');
}
