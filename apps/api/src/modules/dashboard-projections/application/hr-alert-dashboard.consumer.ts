import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AlertRecipientsPort } from '../../notifications/application/ports/alert-recipients.port';
import {
  OutboxEventConsumer,
  OutboxEventConsumerRegistry,
  OutboxEventEnvelope,
} from '../../outbox/application/outbox-event-consumer.registry';
import { DashboardItemRepositoryPort } from './ports/dashboard-item-repository.port';
import { HR_ALERT_EVENT_TYPES, projectHrAlertEvent } from './projectors/hr-alert-event.projector';

/**
 * Respuestas 2026-10-22 #4 y P2 (PasoAPlanilla.v1 solo para avisar): proyecta al tablero (dashboard_items, ALERT) las alertas de la
 * cascada de salidas a campo y de Talento Humano a los roles con el permiso de notificacion NOTIFICATIONS.RECEIVE_*_ALERTS. Idempotente:
 * la clave natural `hr-alert:<eventId>:<ROL>` + el indice unico (source_event_id, item_type) absorben los reintentos del relay.
 */
@Injectable()
export class HrAlertDashboardConsumer implements OutboxEventConsumer, OnModuleInit {
  readonly name = 'dashboard.hr-alerts';
  readonly eventTypes = HR_ALERT_EVENT_TYPES;
  private readonly logger = new Logger(HrAlertDashboardConsumer.name);

  constructor(
    private readonly registry: OutboxEventConsumerRegistry,
    private readonly dashboardItems: DashboardItemRepositoryPort,
    private readonly recipients: AlertRecipientsPort,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(event: OutboxEventEnvelope): Promise<void> {
    const projection = projectHrAlertEvent(event);
    if (projection.action === 'IGNORE') return;
    if (projection.action === 'DISMISS') {
      await this.dashboardItems.dismissBySource(projection.sourceType, projection.sourceId);
      return;
    }

    const { scope, item, replaceSource } = projection;
    if (replaceSource) {
      await this.dashboardItems.dismissBySource(replaceSource.sourceType, replaceSource.sourceId);
    }
    const roles = await this.recipients.rolesWithPermission(scope, item.permission);
    if (roles.length === 0) {
      this.logger.warn(`Evento ${event.eventType} (${event.id}): ningun rol tiene NOTIFICATIONS.${item.permission} en la empresa/sede; sin aviso.`);
      return;
    }
    for (const role of roles) {
      await this.dashboardItems.upsertFromEvent({
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
        branchId: scope.branchId,
        role,
        itemType: 'ALERT',
        priority: item.priority,
        title: item.title,
        detail: item.detail,
        deepLink: item.deepLink,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceEventId: `hr-alert:${event.id}:${role}`,
      });
    }
  }
}
