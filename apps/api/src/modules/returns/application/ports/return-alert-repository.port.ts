import type { ReturnRecord, ReturnScope } from './return-repository.port';

export interface ListAlertCandidatesFilter extends ReturnScope {
  /**
   * Alertas de reloj (garantía 24 h / inmovilización): solo expedientes recibidos en o antes de este instante (el resto no
   * puede estar en alerta aún). null = no se piden alertas de reloj.
   */
  receivedBefore: Date | null;
  /** DEC-DEVREM-003: incluir devoluciones recibidas con retraso > tolerancia y sin cargo por retraso registrado. */
  includeLateCharge: boolean;
  limit: number;
}

/**
 * Candidatos a alerta (garantía por liberar / inmovilización > 24 h): estados SIN_DANOS, CON_DANOS y
 * CIERRE_FINANCIERO con receivedAt (más, si se pide, las recibidas tarde sin cargo registrado). La decisión de alerta es de dominio (return-alerts.ts), no de la consulta.
 */
export abstract class ReturnAlertRepositoryPort {
  abstract listCandidates(filter: ListAlertCandidatesFilter): Promise<ReturnRecord[]>;
}
