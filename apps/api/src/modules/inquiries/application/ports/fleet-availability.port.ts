/**
 * TDD-CON-001.md seccion 13 - `FleetAvailabilityPort` (Inquiries -> Fleet):
 * elegibilidad del vehiculo por destino/ruta, de SOLO LECTURA y sin bloqueo
 * (seccion 10: `quote` nunca modifica `vehicle_commitments`).
 *
 * Hallazgo ALTO de revalidacion PR#7: el flujo cotizaba sin consultar Flota.
 * El modulo real de Flota no existe todavia (PROP-005); este puerto fija el
 * contrato para que el adaptador provisional se reemplace sin tocar los
 * handlers.
 */
export interface VehicleEligibilityQuery {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  vehicleId: string;
  destination: string;
  estimatedDays: number;
}

export type VehicleEligibility =
  | { eligible: true; vehicleId: string }
  | { eligible: false; reason: string };

export abstract class FleetAvailabilityPort {
  /** false mientras el adaptador sea provisional (no apto para produccion). */
  abstract readonly productionReady: boolean;
  abstract checkEligibility(query: VehicleEligibilityQuery): Promise<VehicleEligibility>;
}
