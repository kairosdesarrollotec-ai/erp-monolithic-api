import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RETENTION_CONFIG, RetentionPurgeService } from '../application/retention-purge.service';
import { isRetentionPurgeEnabled, RetentionConfig } from '../retention.config';

/**
 * Programador periódico (mismo patrón que ReturnReminderScheduler/OutboxRelayService: `setInterval` en el proceso
 * de la API, sin dependencias nuevas). Primera corrida tras `initialDelayMs` y luego cada `intervalMs` (default 6 h:
 * en Cloud Run las instancias se reciclan y un intervalo de 24 h podría no cumplirse nunca). Se desactiva con
 * RETENTION_PURGE_ENABLED=false y nunca arranca bajo Jest. Seguro con varias réplicas (SKIP LOCKED + idempotente).
 */
@Injectable()
export class RetentionPurgeScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionPurgeScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private initial: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(
    private readonly service: RetentionPurgeService,
    @Inject(RETENTION_CONFIG) private readonly config: RetentionConfig,
  ) {}

  onModuleInit(): void {
    if (!isRetentionPurgeEnabled()) return;
    for (const w of this.config.warnings) this.logger.warn(w);
    this.initial = setTimeout(() => void this.tick(), this.config.initialDelayMs);
    this.timer = setInterval(() => void this.tick(), this.config.intervalMs);
    this.initial.unref?.();
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.initial) clearTimeout(this.initial);
    if (this.timer) clearInterval(this.timer);
    this.initial = undefined;
    this.timer = undefined;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.service.run();
    } catch (error) {
      this.logger.error(`No se pudo ejecutar la purga de retención: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
