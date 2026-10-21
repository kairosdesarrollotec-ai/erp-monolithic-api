import { Injectable, Logger } from '@nestjs/common';
import { ClockPort } from '../../../common/application/ports/clock.port';
import { LIMA_TIME_ZONE } from '../../../common/time/lima-time';
import { RetentionConfig } from '../retention.config';
import { RetentionPurgePort, RetentionTarget } from './retention-purge.port';

export const RETENTION_CONFIG = Symbol('RETENTION_CONFIG');
const DAY_MS = 24 * 60 * 60_000;

export interface RetentionTargetResult {
  target: RetentionTarget;
  retentionDays: number;
  cutoff: string;
  deleted: number;
  batches: number;
  /** true si se cortó por `maxBatchesPerRun` (quedan filas por purgar; la siguiente corrida continúa). */
  truncated: boolean;
  error?: string;
}

/**
 * Purga de retención NO dependiente de negocio (L-02, 16-oct-2026): `idempotency_keys` (filas vencidas hace más de
 * 1 año; el TTL de replay sigue siendo 24 h), `outbox_events` procesados / dead-letter (1 año) y `dashboard_items` ya VISTOS
 * (descartados/atendidos hace más de `dashboardSeenDays`, 30 d por defecto; los NO vistos nunca se purgan).
 *
 * `audit_events` NO se purga nunca (5 años, append-only): este servicio no lo toca.
 *
 * FUERA DE ALCANCE (no se implementa aquí; ver docs/auditoría 19-oct-2026):
 *  - Fotos de CV (1 año): lifecycle del bucket GCS (age 365 d) cuando exista storage real (S-04 en pausa).
 *  - Logs técnicos (90 d) y trazas (30 d): configuración de plataforma (Cloud Logging / observabilidad).
 *  - Backups (30 d diarios / 12 m mensuales / anual según Legal): Supabase PITR + pg_dump, config de plataforma.
 *  - Evidencia probatoria: 1 año + 5 de archivo (Respuestas 2026-10-20 #30; ver EVIDENCE_RETENTION). Este servicio NO la purga;
 *    nada puede borrarla dentro de los 6 años. Pagos / contratos: plazo aun sin decidir por negocio.
 *
 * Logs: JSON de una línea con solo conteos, plazos y fechas de corte (sin ids, claves, payloads ni datos personales).
 */
@Injectable()
export class RetentionPurgeService {
  private readonly logger = new Logger(RetentionPurgeService.name);

  constructor(
    private readonly purge: RetentionPurgePort,
    private readonly clock: ClockPort,
    private readonly config: RetentionConfig,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async run(): Promise<RetentionTargetResult[]> {
    const startedAt = this.clock.now();
    const c = this.config;
    const plan: Array<[RetentionTarget, number]> = [
      ['IDEMPOTENCY_KEYS', c.idempotencyDays],
      ['OUTBOX_PROCESSED', c.outboxProcessedDays],
      ['OUTBOX_DEAD_LETTER', c.outboxDeadLetterDays],
      ['DASHBOARD_ITEMS_SEEN', c.dashboardSeenDays],
    ];
    const results: RetentionTargetResult[] = [];
    for (const [target, days] of plan) {
      results.push(await this.purgeTarget(target, days, startedAt));
    }
    this.logger.log(
      JSON.stringify({
        event: 'retention.purge.run',
        startedAtLima: this.formatLima(startedAt),
        totalDeleted: results.reduce((s, r) => s + r.deleted, 0),
        targets: results,
      }),
    );
    return results;
  }

  private async purgeTarget(target: RetentionTarget, days: number, now: Date): Promise<RetentionTargetResult> {
    const cutoff = new Date(now.getTime() - days * DAY_MS);
    const result: RetentionTargetResult = {
      target,
      retentionDays: days,
      cutoff: cutoff.toISOString(),
      deleted: 0,
      batches: 0,
      truncated: false,
    };
    try {
      while (result.batches < this.config.maxBatchesPerRun) {
        const n = await this.purge.purgeBatch(target, cutoff, this.config.batchSize);
        result.batches += 1;
        result.deleted += n;
        if (n < this.config.batchSize) return result;
        if (this.config.batchPauseMs > 0) await this.sleep(this.config.batchPauseMs);
      }
      result.truncated = true;
    } catch (error) {
      // Un objetivo fallido no impide purgar los demás; la siguiente corrida reintenta (idempotente).
      result.error = (error as Error).message;
      this.logger.error(JSON.stringify({ event: 'retention.purge.error', target, error: result.error }));
    }
    return result;
  }

  private formatLima(d: Date): string {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: LIMA_TIME_ZONE, dateStyle: 'short', timeStyle: 'medium' }).format(d) + ' America/Lima';
  }
}
