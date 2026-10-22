import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { isEnvFlagEnabled } from '../../../../common/config/env-flag';
import { EvidenceDeletionExpirationService } from '../../application/services/evidence-deletion-expiration.service';

export const DEFAULT_EVIDENCE_DELETION_EXPIRY_INTERVAL_MS = 60 * 60_000;

/**
 * DEC-EVID-DELETE-002 - marca EXPIRED las solicitudes abiertas cuya vigencia (EVIDENCE_DELETION_TTL_DAYS, 7 dias por defecto)
 * ya paso. Mismo patron que ReturnAlertScheduler (`setInterval` en el proceso; idempotente y seguro con varias replicas porque la
 * transicion tiene guarda de estado+version). Se apaga con EVIDENCE_DELETION_EXPIRY_SCHEDULER=off (DEC-OPS-FLAGS-001) y nunca
 * arranca bajo Jest. Aunque el job este apagado, las solicitudes vencidas se ven y se comportan como EXPIRED (estado efectivo).
 */
@Injectable()
export class EvidenceDeletionExpiryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EvidenceDeletionExpiryScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    private readonly expiration: EvidenceDeletionExpirationService,
    private readonly clock: ClockPort,
  ) {}

  onModuleInit(): void {
    if (!isEnvFlagEnabled(process.env.EVIDENCE_DELETION_EXPIRY_SCHEDULER) || process.env.JEST_WORKER_ID !== undefined) return;
    const configured = Number(process.env.EVIDENCE_DELETION_EXPIRY_INTERVAL_MS);
    const intervalMs = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_EVIDENCE_DELETION_EXPIRY_INTERVAL_MS;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const expired = await this.expiration.expireDue(this.clock.now());
      if (expired > 0) this.logger.log(`Solicitudes de eliminacion de evidencia vencidas: ${expired}.`);
      return expired;
    } catch (error) {
      this.logger.error(`No se pudieron vencer las solicitudes de eliminacion de evidencia: ${(error as Error).name}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
