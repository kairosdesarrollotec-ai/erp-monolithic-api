/**
 * TDD-CON-001.md seccion 13 - `FleetAvailabilityPort` (Inquiries -> Fleet):
 * elegibilidad del vehiculo por destino/ruta, de SOLO LECTURA y sin bloqueo
 * (seccion 10: `quote` nunca modifica `vehicle_commitments`).
 *
 * Hallazgo ALTO de revalidacion PR#7: el flujo cotizaba sin consultar Flota.
 * El modulo real de Flota no existe todavia (PROP-005); este puerto fija el
 * contrato para que el adaptador provisional se reemplace sin tocar los
 * handlers.
 *
 * Correccion (oct 2026): el precio de cotizacion viene de aqui
 * (`dailyRate`, el mismo dato que ya administra Flota en FLO-02), no de
 * un tarifario separado por empresa. El `RateCardPort`/`rate_card_versions`
 * introducido en PROP-007 era una decision tecnica provisional nunca
 * confirmada contra el negocio: el tarifario real (`Ficha_AS-IS_VELOXRENT_
 * Alquiler_PARA_NOTION.md` seccion 5.1, TDD-CON-001.md seccion 2.1 "snapshot
 * versionado del tarifario") siempre fue por vehiculo, no por empresa -
 * exactamente lo que ya modela `Vehicle.dailyRate`. Ver quote.handler.ts.
 */
export interface VehicleEligibilityQuery {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  vehicleId: string;
  destination: string;
  estimatedDays: number;
  /**
   * Fecha de inicio del viaje (Inquiry.travelStartDate). Si viene, la
   * disponibilidad se evalua en [startsAt, startsAt + estimatedDays dias);
   * si no, en [ahora, ahora + estimatedDays dias).
   */
  startsAt?: Date;
}

export type VehicleEligibility =
  | { eligible: true; vehicleId: string; dailyRate: string }
  | { eligible: false; reason: string };

export abstract class FleetAvailabilityPort {
  /** false mientras el adaptador sea provisional (no apto para produccion). */
  abstract readonly productionReady: boolean;
  abstract checkEligibility(query: VehicleEligibilityQuery): Promise<VehicleEligibility>;
}
