/**
 * BDD-04-devolucion.md seccion 9.6.1 — Tarifario oficial de daños estéticos (Carrocería).
 * Confirmado 31 ago 2026 (código de vehículo V22, Chevrolet Spin, placa Z7A-434).
 * BR-DEV-006: Los daños estéticos tienen precio fijo por paño. Los daños técnicos NO tienen
 * tabla fija y se resuelven exclusivamente mediante informe individual de Motrix.
 */

export interface CosmeticTariffItem {
  readonly code: string;
  readonly name: string;
  readonly pricePen: number;
}

export const COSMETIC_DAMAGE_TARIFF: ReadonlyMap<string, CosmeticTariffItem> = new Map([
  ['PULIDO_Y_ENCERADO', { code: 'PULIDO_Y_ENCERADO', name: 'Pulido y encerado', pricePen: 30.0 }],
  ['ESPEJOS', { code: 'ESPEJOS', name: 'Paño en los espejos', pricePen: 100.0 }],
  ['CAPOT', { code: 'CAPOT', name: 'Paño en el capot', pricePen: 200.0 }],
  ['MALETERA', { code: 'MALETERA', name: 'Paño en la maletera', pricePen: 250.0 }],
  ['PUERTA_CONDUCTOR', { code: 'PUERTA_CONDUCTOR', name: 'Paño en puerta conductor (lateral delantera izq)', pricePen: 180.0 }],
  ['PUERTA_PASAJERO_DELANTERA', { code: 'PUERTA_PASAJERO_DELANTERA', name: 'Paño en puerta de pasajero (lateral delantera der)', pricePen: 180.0 }],
  ['PUERTA_LATERAL_IZQUIERDA', { code: 'PUERTA_LATERAL_IZQUIERDA', name: 'Paño en puerta lateral izquierda', pricePen: 180.0 }],
  ['PUERTA_LATERAL_DERECHA', { code: 'PUERTA_LATERAL_DERECHA', name: 'Paño en puerta lateral derecha', pricePen: 180.0 }],
  ['LATERAL_DELANTERA_IZQUIERDA', { code: 'LATERAL_DELANTERA_IZQUIERDA', name: 'Paño lateral delantera izquierda', pricePen: 180.0 }],
  ['LATERAL_DELANTERA_DERECHA', { code: 'LATERAL_DELANTERA_DERECHA', name: 'Paño lateral delantera derecha', pricePen: 180.0 }],
  ['LATERAL_POSTERIOR_IZQUIERDA', { code: 'LATERAL_POSTERIOR_IZQUIERDA', name: 'Paño última parte lateral izquierda', pricePen: 180.0 }],
  ['LATERAL_POSTERIOR_DERECHA', { code: 'LATERAL_POSTERIOR_DERECHA', name: 'Paño última parte lateral derecha', pricePen: 180.0 }],
  ['TECHO', { code: 'TECHO', name: 'Paño parte del techo', pricePen: 180.0 }],
  ['COMBUSTIBLE_POR_LINEA', { code: 'COMBUSTIBLE_POR_LINEA', name: 'Llenado de combustible por línea', pricePen: 50.0 }],
]);

/**
 * Normaliza una cadena de zona (p.ej. "puerta_conductor" o "PUERTA_CONDUCTOR")
 * para contrastar contra el tarifario oficial.
 */
export function normalizeZoneCode(zone: string): string {
  return zone
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, '_');
}

export function getCosmeticDamageRate(zone: string): number | null {
  const normalized = normalizeZoneCode(zone);
  const item = COSMETIC_DAMAGE_TARIFF.get(normalized);
  return item ? item.pricePen : null;
}

export function isKnownCosmeticZone(zone: string): boolean {
  return getCosmeticDamageRate(zone) !== null;
}

/** Catálogo del tarifario en orden de definición (GET /returns/cosmetic-tariff). */
export function listCosmeticTariff(): CosmeticTariffItem[] {
  return [...COSMETIC_DAMAGE_TARIFF.values()];
}

/** Códigos válidos de `damagedZone` para daños estéticos. */
export const COSMETIC_ZONE_CODES: readonly string[] = [...COSMETIC_DAMAGE_TARIFF.keys()];
