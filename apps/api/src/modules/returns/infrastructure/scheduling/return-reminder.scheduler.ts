import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GenerateDueReturnRemindersHandler } from '../../application/commands/generate-due-return-reminders.handler';
import { isEnvFlagEnabled } from '../../../../common/config/env-flag';

/** El recordatorio se genera 3 h antes; revisar cada 5 min deja un desfase máximo de 5 min (BR-DEV-004 tolera 30). */
export const DEFAULT_RETURN_REMINDER_INTERVAL_MS = 5 * 60_000;

/**
 * Programador periódico (mismo patrón que FieldTripCascadeScheduler: `setInterval` en el proceso de la API, sin
 * dependencias nuevas) que genera los recordatorios PENDING de devolución (DEC-DEV-REMINDER-001). No envía mensajes:
 * el envío de WhatsApp es manual-asistido. Seguro con varias réplicas (return_id UNIQUE + skipDuplicates);
 * `running` solo evita solapar ciclos de ESTE proceso. Se desactiva con RETURN_REMINDER_SCHEDULER=off y nunca
 * arranca bajo Jest.
 */
@Injectable()
export class ReturnReminderScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReturnReminderScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly generateDue: GenerateDueReturnRemindersHandler) {}

  onModuleInit(): void {
    if (!isEnvFlagEnabled(process.env.RETURN_REMINDER_SCHEDULER) || process.env.JEST_WORKER_ID !== undefined) {
      return;
    }
    const configured = Number(process.env.RETURN_REMINDER_INTERVAL_MS);
    const intervalMs = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_RETURN_REMINDER_INTERVAL_MS;
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
      const result = await this.generateDue.execute();
      if (result.created > 0) {
        this.logger.log(`Recordatorios de devolución generados: ${result.created} (candidatas: ${result.candidates}).`);
      }
    } catch (error) {
      // Un ciclo fallido no debe tumbar la API: el siguiente reintenta (la generación es idempotente).
      this.logger.error(`No se pudieron generar los recordatorios de devolución: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
