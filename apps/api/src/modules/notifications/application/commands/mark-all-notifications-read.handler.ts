import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { NotificationReadModelPort } from '../ports/notification-read-model.port';
import { MarkAllNotificationsReadCommand } from './mark-all-notifications-read.command';

/**
 * TR-07 - "marcar todas como leidas" (contrato punto 7, accion
 * secundaria). No es un evento auditable (contrato punto 11: "No
 * aplica (lectura)") - marcar como leida es un cambio de estado
 * puramente personal, no una accion de negocio.
 */
@Injectable()
export class MarkAllNotificationsReadHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly notifications: NotificationReadModelPort,
  ) {}

  async execute(command: MarkAllNotificationsReadCommand): Promise<void> {
    const context = await this.workContext.authorize({
      firebaseUid: command.actorFirebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.notifications.markAllRead(context.organizationId, command.actorFirebaseUid);
  }
}
