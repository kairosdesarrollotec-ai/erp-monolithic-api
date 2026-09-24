import { Inject, Injectable } from '@nestjs/common';
import { FleetAvailabilityPort } from '../ports/fleet-availability.port';
import { RateCardPort } from '../ports/rate-card.port';
import { QuotingNotProductionReadyError } from '../../domain/inquiry-errors';

export const PROVISIONAL_QUOTING_POLICY = Symbol('PROVISIONAL_QUOTING_POLICY');

export interface ProvisionalQuotingPolicy {
  /** true cuando la API corre en produccion (NODE_ENV=production). */
  production: boolean;
  /** Habilitacion EXPLICITA (KAIROS_ALLOW_PROVISIONAL_QUOTING=true) para usar adaptadores provisionales en produccion. */
  allowProvisional: boolean;
}

export function provisionalQuotingPolicyFromEnv(env: NodeJS.ProcessEnv): ProvisionalQuotingPolicy {
  return {
    production: env.NODE_ENV === 'production',
    allowProvisional: env.KAIROS_ALLOW_PROVISIONAL_QUOTING === 'true',
  };
}

/**
 * Hallazgo ALTO de revalidacion PR#7 ("el flujo provisional cotiza sin
 * disponibilidad/tarifa productiva - corregir antes de habilitar
 * produccion"): control concreto, no solo documental. Si Flota o el
 * tarifario siguen siendo adaptadores provisionales y la API corre en
 * produccion, cotizar y convertir responden 503 QUOTING_NOT_PRODUCTION_READY
 * - a menos que alguien lo habilite EXPLICITAMENTE por variable de entorno
 * (decision consciente y auditable, nunca por omision). Fuera de produccion
 * (desarrollo/QA) el flujo provisional funciona normalmente.
 */
@Injectable()
export class ProvisionalQuotingGuard {
  constructor(
    private readonly fleet: FleetAvailabilityPort,
    private readonly rateCards: RateCardPort,
    @Inject(PROVISIONAL_QUOTING_POLICY) private readonly policy: ProvisionalQuotingPolicy,
  ) {}

  assertReady(): void {
    if (!this.policy.production || this.policy.allowProvisional) {
      return;
    }
    if (!this.fleet.productionReady) {
      throw new QuotingNotProductionReadyError('La elegibilidad de Flota (FleetAvailabilityPort)');
    }
    if (!this.rateCards.productionReady) {
      throw new QuotingNotProductionReadyError('El tarifario versionado (RateCardPort)');
    }
  }
}
