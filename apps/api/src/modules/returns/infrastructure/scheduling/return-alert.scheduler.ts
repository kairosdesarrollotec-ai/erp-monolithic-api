import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PublishReturnDashboardAlertsHandler } from '../../application/commands/publish-return-dashboard-alerts.handler';

/** La alerta se publica con DUE_SOON a 4 h del límite y OVERDUE al vencer; revisar cada 5 min deja un desfase máximo de 5 min. */
export const DEFAULT_RETURN_ALERT_INTERVAL_MS = 5 * 60_000;

/**
 * Programador periódico (mismo patrón que ReturnReminderScheduler: `setInterval` en el proceso de la API, sin dependencias
 * nuevas) que proyecta la alerta de garantía de 24 h al tablero de Finanzas (DEC-DEVREM-002). Seguro con varias réplicas
 * (la idempotencia vive en la base: clave natural + índice único); `running` solo evita solapar ciclos de ESTE proceso.
 * Se desactiva con RETURN_ALERT_SCHEDULER=off y nunca arranca bajo Jest. Los logs solo llevan conteos (sin datos personales).
 */
@Injectable()
export class ReturnAlertScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReturnAlertScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly publish: PublishReturnDashboardAlertsHandler) {}

  onModuleInit(): void {
    if (process.env.RETURN_ALERT_SCHEDULER === 'off' || process.env.JEST_WORKER_ID !== undefined) {
      return;
    }
    const configured = Number(process.env.RETURN_ALERT_INTERVAL_MS);
    const intervalMs = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_RETURN_ALERT_INTERVAL_MS;
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
      const result = await this.publish.execute();
      if (result.created > 0 || result.dismissed > 0) {
        this.logger.log(
          `Alertas de garantía en el tablero: ${result.created} creadas, ${result.dismissed} descartadas (candidatas: ${result.candidates}).`,
        );
      }
    } catch (error) {
      // Un ciclo fallido no debe tumbar la API: el siguiente reintenta (la publicación es idempotente). Solo se registra el
      // tipo del error: el mensaje de la base puede incluir valores de filas.
      this.logger.error(`No se pudieron publicar las alertas de garantía en el tablero: ${(error as Error).name}`);
    } finally {
      this.running = false;
    }
  }
}
