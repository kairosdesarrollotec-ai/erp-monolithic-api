import { Injectable, Logger } from '@nestjs/common';

/** Evento del outbox tal como lo reclama el relay. */
export interface OutboxEventEnvelope {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  createdAt: Date;
}

/**
 * Consumidor de eventos del outbox registrado por un modulo de dominio. El relay (`OutboxRelayService`) es el UNICO
 * proceso que reclama `outbox_events`; en vez de importar cada modulo consumidor (lo que crearia ciclos de modulos,
 * p. ej. Users -> DashboardProjections -> Recruitment -> Users), los consumidores se REGISTRAN aqui en `onModuleInit`
 * y el relay solo despacha. `handle` debe ser IDEMPOTENTE: si falla, el relay reintenta el evento completo.
 */
export interface OutboxEventConsumer {
  readonly name: string;
  readonly eventTypes: readonly string[];
  handle(event: OutboxEventEnvelope): Promise<void>;
}

@Injectable()
export class OutboxEventConsumerRegistry {
  private readonly logger = new Logger(OutboxEventConsumerRegistry.name);
  private readonly consumers: OutboxEventConsumer[] = [];

  register(consumer: OutboxEventConsumer): void {
    if (this.consumers.some((c) => c.name === consumer.name)) return; // registro idempotente (hot reload / tests)
    this.consumers.push(consumer);
  }

  consumersFor(eventType: string): OutboxEventConsumer[] {
    return this.consumers.filter((c) => c.eventTypes.includes(eventType));
  }

  /**
   * Despacha el evento a todos los consumidores que lo declaran. Si uno falla, se siguen intentando los demas y al final
   * se relanza el PRIMER error, para que el relay reintente (los consumidores son idempotentes).
   */
  async dispatch(event: OutboxEventEnvelope): Promise<void> {
    let firstError: unknown;
    for (const consumer of this.consumersFor(event.eventType)) {
      try {
        await consumer.handle(event);
      } catch (error) {
        this.logger.error(`Consumidor ${consumer.name} fallo con ${event.eventType} (${event.id}): ${(error as Error).message}`);
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
  }
}
