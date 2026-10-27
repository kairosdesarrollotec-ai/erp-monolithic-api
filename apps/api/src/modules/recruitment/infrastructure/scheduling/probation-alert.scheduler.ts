import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { isEnvFlagEnabled } from '../../../../common/config/env-flag';
import { ProbationAlertService } from '../../application/services/probation-alert.service';

export const DEFAULT_PROBATION_ALERT_INTERVAL_MS = 60 * 60_000; // Cada 1 hora

/**
 * HU-33: Programador periódico que evalúa fin de periodo de prueba a los 3 meses y emite
 * alertas a Gerencia General 15 días antes.
 * Desactivado bajo Jest y controlable con PROBATION_ALERT_SCHEDULER=off.
 */
@Injectable()
export class ProbationAlertScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProbationAlertScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly service: ProbationAlertService) {}

  onModuleInit(): void {
    if (!isEnvFlagEnabled(process.env.PROBATION_ALERT_SCHEDULER) || process.env.JEST_WORKER_ID !== undefined) {
      return;
    }
    const configured = Number(process.env.PROBATION_ALERT_INTERVAL_MS);
    const intervalMs = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_PROBATION_ALERT_INTERVAL_MS;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.service.run();
      if (result.alertsCreated > 0) {
        this.logger.log(`Alertas de periodo de prueba: ${result.alertsCreated} creadas (${result.candidatesChecked} evaluados).`);
      }
    } catch (error) {
      this.logger.error(`No se pudieron evaluar las alertas de periodo de prueba: ${(error as Error).name}`);
    } finally {
      this.running = false;
    }
  }
}
