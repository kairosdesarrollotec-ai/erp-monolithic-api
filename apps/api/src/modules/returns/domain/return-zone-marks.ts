/**
 * DEV-05 / PD-07 (G2, 22-oct-2026) - Marcas por zona del comparador "Resultado".
 *
 * Cada zona se evalua de forma explicita ("Sin daño" / "Con daño"); nunca se asume "sin daño" por defecto. Las 5 zonas son las del
 * checklist de recepcion (las mismas de la evidencia). La RUTA TOMADA solo existe cuando las 5 zonas estan marcadas:
 *  - NO_DAMAGE: las 5 zonas "Sin daño" (salto directo a DEV-09, liberar garantia).
 *  - DAMAGE: al menos una zona "Con daño" (continuar a DEV-06, evaluacion de daño).
 * La ruta "incidente" (INC-02) la registra el modulo de Incidencias con su propio evento; aqui no se infiere.
 */
export const RETURN_ZONE_MARK_ZONES = ['FRONTAL', 'LATERAL_IZQUIERDO', 'LATERAL_DERECHO', 'POSTERIOR', 'INTERIOR'] as const;
export type ReturnZoneMarkZone = (typeof RETURN_ZONE_MARK_ZONES)[number];

export const RETURN_ZONE_MARK_VALUES = ['NO_DAMAGE', 'DAMAGE'] as const;
export type ReturnZoneMarkValue = (typeof RETURN_ZONE_MARK_VALUES)[number];

export type ReturnRouteTaken = 'NO_DAMAGE' | 'DAMAGE';

export interface ReturnZoneMarkRecord {
  zone: ReturnZoneMarkZone;
  mark: ReturnZoneMarkValue;
  markedBy: string;
  markedAt: Date;
}

/** null mientras falte alguna de las 5 zonas. */
export function deriveRouteTaken(marks: ReadonlyArray<{ zone: string; mark: ReturnZoneMarkValue }>): ReturnRouteTaken | null {
  const byZone = new Map(marks.map((m) => [m.zone, m.mark]));
  if (!RETURN_ZONE_MARK_ZONES.every((zone) => byZone.has(zone))) return null;
  return RETURN_ZONE_MARK_ZONES.some((zone) => byZone.get(zone) === 'DAMAGE') ? 'DAMAGE' : 'NO_DAMAGE';
}
