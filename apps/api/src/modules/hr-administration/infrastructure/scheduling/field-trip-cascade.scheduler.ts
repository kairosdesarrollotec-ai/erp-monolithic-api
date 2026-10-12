import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ProcessDueFieldTripTimeoutsHandler } from '../../application/commands/process-due-field-trip-timeouts.handler';

/** NFR-BIZ-008: la cascada se revisa cada minuto (cada nivel dura 5 min; el desfase máximo es de 1 min). */
export const DEFAULT_FIELD_TRIP_CASCADE_INTERVAL_MS = 60_000;

/**
 * Programador periódico (mismo patrón que el relay del outbox: `setInterval` en el proceso de la API, sin
 * dependencias nuevas) que avanza la cascada de salidas a campo por vencimiento del temporizador.
 * Seguro con varias réplicas: el reclamo de cada salida usa `FOR UPDATE SKIP LOCKED` en la base de datos
 * (ver ProcessDueFieldTripTimeoutsHandler); `running` solo evita solapar ciclos de ESTE proceso.
 * Se desactiva con HR_FIELD_TRIP_CASCADE_SCHEDULER=off y nunca arranca bajo Jest.
 */
@Injectable()
export class FieldTripCascadeScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FieldTripCascadeScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly processDue: ProcessDueFieldTripTimeoutsHandler) {}

  onModuleInit(): void {
    if (process.env.HR_FIELD_TRIP_CASCADE_SCHEDULER === 'off' || process.env.JEST_WORKER_ID !== undefined) {
      return;
    }
    const configured = Number(process.env.HR_FIELD_TRIP_CASCADE_INTERVAL_MS);
    const intervalMs =
      Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_FIELD_TRIP_CASCADE_INTERVAL_MS;
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
      await this.processDue.execute();
    } catch (error) {
      // Un ciclo fallido no debe tumbar la API: el siguiente minuto reintenta (la escalación es idempotente).
      this.logger.error(`No se pudo avanzar la cascada de salidas a campo: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
