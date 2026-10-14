import type { ReturnRecord, ReturnScope } from './return-repository.port';

export interface ListAlertCandidatesFilter extends ReturnScope {
  /** Solo expedientes recibidos en o antes de este instante (el resto no puede estar en alerta aún). */
  receivedBefore: Date;
  limit: number;
}

/**
 * Candidatos a alerta (garantía por liberar / inmovilización > 24 h): estados SIN_DANOS, CON_DANOS y
 * CIERRE_FINANCIERO con receivedAt. La decisión de alerta es de dominio (return-alerts.ts), no de la consulta.
 */
export abstract class ReturnAlertRepositoryPort {
  abstract listCandidates(filter: ListAlertCandidatesFilter): Promise<ReturnRecord[]>;
}
