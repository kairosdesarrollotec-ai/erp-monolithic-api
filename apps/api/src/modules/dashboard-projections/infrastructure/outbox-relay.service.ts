import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/persistence/prisma.service';
import { DashboardItemRepositoryPort } from '../application/ports/dashboard-item-repository.port';
import { projectReservationEvent } from '../application/projectors/reservation-event.projector';
import { NotificationReadModelPort } from '../../notifications/application/ports/notification-read-model.port';
import { NotificationTemplatePort } from '../../notification-templates/application/ports/notification-template.port';
import { projectNotificationEvent } from '../../notifications/domain/notification-event-projector';
import { NotificationDispatcherPort } from '../../notifications/application/ports/notification-dispatcher.port';

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_BASE_BACKOFF_MS = 5_000;
const DEFAULT_MAX_BACKOFF_MS = 5 * 60_000;
const DEFAULT_MAX_ATTEMPTS = 10;

interface ClaimedOutboxEventRow {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  createdAt: Date;
  attempts: number;
}

/**
 * Consumidor del outbox transaccional (TDD-KAIROS-TRANSVERSAL.md 7.3,
 * ADR-KAI-003) para TR-06 y TR-07 (ver ALCANCE REAL en
 * dashboard-projections.module.ts sobre por que ambas proyecciones
 * comparten un unico relay). Sigue siendo polling en el mismo proceso de
 * la API (setInterval, sin dependencias nuevas) - el worker separado
 * sobre Cloud Tasks del diseno de referencia
 * (claude/Diseno_Agregador_Transversal_TR-06-07-08.md) sigue fuera de
 * alcance.
 *
 * Hallazgo ALTO de revalidacion PR#7 ("outbox sin fiabilidad real"),
 * resuelto en esta version (migracion
 * 20260924020000_outbox_event_reliability):
 * - CLAIM ATOMICO multi-replica-seguro: `SELECT ... FOR UPDATE SKIP
 *   LOCKED` + `UPDATE` en una sola sentencia SQL - si en algun momento
 *   corre mas de una instancia de la API (o mas de un proceso en el
 *   mismo host), dos relays nunca reclaman el mismo evento a la vez.
 *   `lockedUntil` es el arriendo (lease): si el proceso muere a mitad de
 *   proyectar un evento, el arriendo expira solo y otro ciclo (de este
 *   proceso u otro) lo vuelve a reclamar - ya no queda "atascado" para
 *   siempre como con el `running` boolean anterior (que solo protegia
 *   contra solaparse consigo mismo, no contra otra replica).
 * - BACKOFF EXPONENCIAL: un evento que falla ya no se reintenta en el
 *   siguiente ciclo inmediato indefinidamente - el arriendo tras un
 *   fallo crece como `min(maxBackoff, baseBackoff * 2^(attempts-1))`.
 * - DEAD-LETTER QUEUE (DLQ): tras `maxAttempts` fallos consecutivos,
 *   `deadLetteredAt` se marca y el evento deja de reclamarse - nunca se
 *   borra (requiere revision manual, mismo criterio de nunca perder
 *   historial que el resto del backend), pero ya no consume ciclos de
 *   polling ni ensucia los logs con el mismo error para siempre.
 *
 * Los metodos de claim/complete/fail usan SQL crudo (`$queryRaw`/
 * `$executeRaw`) en vez de metodos tipados de Prisma Client: este
 * entorno de desarrollo no tiene red hacia binaries.prisma.sh
 * (PROP-003/NOTA-PROP-003, docs/decision-log.md), asi que el cliente
 * Prisma generado localmente puede no conocer todavia las columnas
 * nuevas de la migracion. El SQL crudo funciona igual contra cualquier
 * base ya migrada, sin depender de que `prisma generate` haya corrido.
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  private readonly batchSize = Number(process.env.OUTBOX_RELAY_BATCH_SIZE ?? DEFAULT_BATCH_SIZE);
  private readonly leaseMs = Number(process.env.OUTBOX_RELAY_LEASE_MS ?? DEFAULT_LEASE_MS);
  private readonly baseBackoffMs = Number(process.env.OUTBOX_RELAY_BASE_BACKOFF_MS ?? DEFAULT_BASE_BACKOFF_MS);
  private readonly maxBackoffMs = Number(process.env.OUTBOX_RELAY_MAX_BACKOFF_MS ?? DEFAULT_MAX_BACKOFF_MS);
  private readonly maxAttempts = Number(process.env.OUTBOX_RELAY_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardItems: DashboardItemRepositoryPort,
    private readonly notifications: NotificationReadModelPort,
    private readonly notificationTemplates: NotificationTemplatePort,
    private readonly dispatcher: NotificationDispatcherPort,
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
    if (this.running) return; // evita solapar ciclos de ESTE proceso; el claim SQL protege contra otras replicas
    this.running = true;
    try {
      const pending = await this.claimBatch();

      for (const event of pending) {
        try {
          const dashboardResult = projectReservationEvent(event);
          if (dashboardResult.action === 'UPSERT') {
            await this.dashboardItems.upsertFromEvent(dashboardResult.item);
          } else if (dashboardResult.action === 'DISMISS') {
            await this.dashboardItems.dismissBySource(dashboardResult.sourceType, dashboardResult.sourceId);
          }

          await this.projectNotification(event);

          await this.markProcessed(event.id);
        } catch (error) {
          await this.markFailed(event, error as Error);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async claimBatch(): Promise<ClaimedOutboxEventRow[]> {
    return this.prisma.$queryRaw<ClaimedOutboxEventRow[]>(Prisma.sql`
      UPDATE outbox_events
      SET locked_until = now() + (${this.leaseMs} * interval '1 millisecond')
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE processed_at IS NULL
          AND dead_lettered_at IS NULL
          AND (locked_until IS NULL OR locked_until < now())
        ORDER BY created_at ASC
        LIMIT ${this.batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id,
        aggregate_type AS "aggregateType",
        aggregate_id AS "aggregateId",
        event_type AS "eventType",
        payload,
        created_at AS "createdAt",
        attempts
    `);
  }

  private async markProcessed(id: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE outbox_events SET processed_at = now(), locked_until = NULL WHERE id = ${id}
    `);
  }

  private async markFailed(event: ClaimedOutboxEventRow, error: Error): Promise<void> {
    const nextAttempts = event.attempts + 1;
    const message = error.message?.slice(0, 2000) ?? 'Error desconocido';

    if (nextAttempts >= this.maxAttempts) {
      this.logger.error(
        `Evento ${event.id} (${event.eventType}) agoto sus ${this.maxAttempts} reintentos - se marca DEAD-LETTER y deja de reclamarse. Requiere revision manual. Ultimo error: ${message}`,
        error,
      );
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE outbox_events
        SET attempts = ${nextAttempts},
            last_error = ${message},
            dead_lettered_at = now(),
            locked_until = NULL
        WHERE id = ${event.id}
      `);
      return;
    }

    const backoffMs = this.computeBackoffMs(nextAttempts);
    this.logger.error(
      `No se pudo proyectar el evento ${event.id} (${event.eventType}) - intento ${nextAttempts}/${this.maxAttempts}, siguiente reintento en ${backoffMs}ms`,
      error,
    );
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE outbox_events
      SET attempts = ${nextAttempts},
          last_error = ${message},
          locked_until = now() + (${backoffMs} * interval '1 millisecond')
      WHERE id = ${event.id}
    `);
  }

  private computeBackoffMs(attempts: number): number {
    const exponential = this.baseBackoffMs * 2 ** (attempts - 1);
    return Math.min(this.maxBackoffMs, exponential);
  }

  /**
   * TR-07 - usa la plantilla vigente de ADM-05 para el evento (si el
   * admin guardo una); si nunca se guardo ninguna, projectNotificationEvent
   * cae a su texto generico de respaldo (ver
   * notification-event-projector.ts) en vez de dejar al usuario sin
   * notificacion.
   *
   * Adicionalmente, si la plantilla tiene canales externos configurados
   * (EMAIL, PUSH, SMS), despacha mediante NotificationDispatcherPort.
   * RESILIENCIA: el despacho externo corre aislado en try/catch para que
   * un error de red o de proveedor externo no aborte la marcacion del
   * evento ni envenene el outbox relay.
   */
  private async projectNotification(event: {
    id: string;
    aggregateId: string;
    eventType: string;
    payload: unknown;
  }): Promise<void> {
    const payload = event.payload as { organizationId?: string };
    const organizationId = payload.organizationId;
    const template = organizationId
      ? await this.notificationTemplates.getCurrent(organizationId, event.eventType)
      : null;

    const result = projectNotificationEvent(event, template?.body ?? null);
    if (result.action === 'CREATE') {
      await this.notifications.create(result.item);

      const channels = template?.channels ?? [];
      if (channels.length > 0) {
        try {
          await this.dispatcher.dispatch({
            sourceEventId: event.id,
            eventType: event.eventType,
            organizationId: result.item.organizationId,
            companyId: result.item.companyId,
            branchId: result.item.branchId,
            recipientFirebaseUid: result.item.recipientFirebaseUid,
            title: result.item.title,
            body: result.item.title,
            deepLink: result.item.deepLink,
            channels,
          });
        } catch (dispatchError) {
          this.logger.error(
            `Fallo no bloqueante en despacho externo para evento ${event.id}: ${(dispatchError as Error).message}`,
          );
        }
      }
    }
  }
}
