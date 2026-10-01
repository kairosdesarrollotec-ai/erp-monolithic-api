/**
 * TDD-CON-001.md 9/11.2 - `quote` toma un snapshot de un tarifario
 * VERSIONADO (`rate_card_version_id`). Hallazgo ALTO de revalidacion PR#7
 * ("tarifario versionado"): el handler dejaba de depender de una constante
 * importada directamente; ahora pide la version vigente a este puerto.
 */
export interface RateCardVersion {
  version: string;
  amountPerDay: string; // Decimal como string
  currency: string;
  validityHours: number;
}

export abstract class RateCardPort {
  /** false mientras el tarifario sea provisional (no apto para produccion). */
  abstract readonly productionReady: boolean;
  abstract currentFor(organizationId: string, operatingCompanyId: string, at: Date): Promise<RateCardVersion>;
}
