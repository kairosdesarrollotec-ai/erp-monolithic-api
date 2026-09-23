import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/persistence/prisma.service';
import { DashboardItemRepositoryPort } from '../application/ports/dashboard-item-repository.port';
import { projectReservationEvent } from '../application/projectors/reservation-event.projector';

/**
 * Consumidor del outbox transaccional (TDD-KAIROS-TRANSVERSAL.md 7.3,
 * ADR-KAI-003) para TR-06. El diseno de referencia
 * (claude/Diseno_Agregador_Transversal_TR-06-07-08.md, Project KAIROS)
 * propone un worker separado sobre Cloud Tasks (apps/worker) - ese
 * paquete no existe todavia en este repo y agregar la infraestructura de
 * Cloud Tasks es un cambio mayor fuera de alcance de este paso. Como
 * sustituto pragmatico de MVP, este servicio hace polling en el mismo
 * proceso de la API (setInterval, sin dependencias nuevas) sobre
 * outbox_events pendientes - cumple la misma funcion (evento persistido
 * -> proyeccion actualizada, de forma asincrona y desacoplada del
 * request original) sin bloquear el handler que confirma/cancela/crea la
 * reserva.
 *
 * Limitacion conocida, documentada en vez de ocultada: OutboxEvent (tal
 * como esta modelado hoy en schema.prisma) no tiene columnas de
 * `attempts`/`last_error` (a diferencia de la tabla de referencia del
 * TDD) - un evento que falla al proyectarse queda con `processedAt` en
 * null y se reintenta en el siguiente ciclo indefinidamente, sin backoff
 * ni limite. Aceptable para el volumen actual (Reservations es el unico
 * emisor); revisar antes de sumar mas modulos emisores de eventos.
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardItems: DashboardItemRepositoryPort,
  ) {}

  onModuleInit(): void {
    const intervalMs = Number(process.env.OUTBOX_RELAY_INTERVAL_MS ?? 5000);
    this.timer = setInterval(() => {
      void this.processPendingEvents();
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async processPendingEvents(): Promise<void> {
    if (this.running) return; // evita solapar ciclos si un lote tarda mas que el intervalo
    this.running = true;
    try {
      const pending = await this.prisma.outboxEvent.findMany({
        where: { processedAt: null, aggregateType: 'Reservation' },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      for (const event of pending) {
        try {
          const result = projectReservationEvent(event);
          if (result.action === 'UPSERT') {
            await this.dashboardItems.upsertFromEvent(result.item);
          } else if (result.action === 'DISMISS') {
            await this.dashboardItems.dismissBySource(result.sourceType, result.sourceId);
          }
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: { processedAt: new Date() },
          });
        } catch (error) {
          this.logger.error(
            `No se pudo proyectar el evento ${event.id} (${event.eventType}) - queda pendiente para reintento`,
            error as Error,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
