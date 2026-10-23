import type { ReturnRecord, ReturnScope } from './return-repository.port';

export interface ListAlertCandidatesFilter extends ReturnScope {
  /**
   * Alerta de garantía 24 h: solo expedientes recibidos en o antes de este instante (el resto no puede estar en alerta aún).
   * null = no se pide la alerta de garantía.
   */
  receivedBefore: Date | null;
  /**
   * Alerta de inmovilización (BR-DEV-011, reloj desde el CIERRE de la devolución, 22-oct-2026): solo devoluciones CERRADA con
   * closedAt en o antes de este instante. null = no se pide la alerta de inmovilización.
   */
  closedBefore: Date | null;
  /** DEC-DEVREM-003: incluir devoluciones recibidas con retraso > tolerancia y sin cargo por retraso registrado. */
  includeLateCharge: boolean;
  limit: number;
}

/**
 * Candidatos a alerta (garantía por liberar / inmovilización > 24 h): estados SIN_DANOS (garantía) y CERRADA con daño técnico (inmovilización) (más, si se pide, las recibidas tarde sin cargo registrado). La decisión de alerta es de dominio (return-alerts.ts), no de la consulta.
 */
export abstract class ReturnAlertRepositoryPort {
  abstract listCandidates(filter: ListAlertCandidatesFilter): Promise<ReturnRecord[]>;
}
