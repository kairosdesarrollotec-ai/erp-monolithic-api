import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { NotificationTemplatePort, NotificationTemplateSnapshot } from '../../../notification-templates/application/ports/notification-template.port';
import { NOTIFICATION_EVENT_CATALOG } from '../../../notification-templates/domain/notification-event-catalog';
import { ALLOWED_NOTIFICATION_VARIABLES, NOTIFICATION_CHANNELS } from '../../../notification-templates/domain/notification-variable-catalog';
import { assertAdminRoleAllowed } from '../policies/admin-role-policy';
import { GetNotificationTemplatesQuery } from './get-notification-templates.query';

export interface NotificationTemplateResult {
  eventType: string;
  label: string;
  current: NotificationTemplateSnapshot | null;
  history: NotificationTemplateSnapshot[];
}

export interface NotificationTemplatesResult {
  templates: NotificationTemplateResult[];
  allowedVariables: readonly string[];
  channels: readonly string[];
}

/**
 * ADM-05 - lee, por cada evento del catalogo, su plantilla vigente +
 * historial (o null si nunca se guardo una), junto con las variables
 * permitidas y los canales validos que la pantalla necesita para
 * construir el editor y su validacion.
 */
@Injectable()
export class GetNotificationTemplatesHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly templates: NotificationTemplatePort,
  ) {}

  async execute(query: GetNotificationTemplatesQuery): Promise<NotificationTemplatesResult> {
    const context = await this.workContext.authorize({
      firebaseUid: query.actorFirebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    assertAdminRoleAllowed(context.role, 'MANAGE_NOTIFICATIONS');

    const templates = await Promise.all(
      NOTIFICATION_EVENT_CATALOG.map(async (descriptor) => {
        const [current, history] = await Promise.all([
          this.templates.getCurrent(context.organizationId, descriptor.eventType),
          this.templates.listHistory(context.organizationId, descriptor.eventType),
        ]);
        return { eventType: descriptor.eventType, label: descriptor.label, current, history };
      }),
    );

    return { templates, allowedVariables: ALLOWED_NOTIFICATION_VARIABLES, channels: NOTIFICATION_CHANNELS };
  }
}
