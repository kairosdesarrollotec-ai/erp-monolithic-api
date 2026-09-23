import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { NotificationReadModelPort, NotificationRecord } from '../ports/notification-read-model.port';
import { GetMyNotificationsQuery } from './get-my-notifications.query';

/**
 * TR-07 - "cada uno ve solo sus propias notificaciones" (contrato punto
 * 3): el destinatario siempre es el propio usuario autenticado
 * (context viene de WorkContextAuthorizationService, nunca de un
 * parametro que el cliente pueda manipular).
 */
@Injectable()
export class GetMyNotificationsHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly notifications: NotificationReadModelPort,
  ) {}

  async execute(query: GetMyNotificationsQuery): Promise<NotificationRecord[]> {
    const context = await this.workContext.authorize({
      firebaseUid: query.actorFirebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    return this.notifications.listForRecipient(context.organizationId, query.actorFirebaseUid, {
      unreadOnly: query.unreadOnly,
    });
  }
}
