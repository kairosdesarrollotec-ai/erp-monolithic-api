import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { NotificationTemplatePort, NotificationTemplateSnapshot } from '../../../notification-templates/application/ports/notification-template.port';
import { isKnownEventType } from '../../../notification-templates/domain/notification-event-catalog';
import { findUnsafeVariables } from '../../../notification-templates/domain/notification-variable-catalog';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { SaveNotificationTemplateCommand } from './save-notification-template.command';

/**
 * ADM-05 - "Guardar plantilla" (contrato punto 7). Igual disciplina de
 * versionado que ADM-03: nunca edita, siempre inserta una version
 * nueva (contrato punto 11: "cambio de plantilla" queda auditado con
 * historial).
 *
 * Regla BDD/SDD (contrato punto 8, criterio de aceptacion 14): "sin
 * datos sensibles en logs ni mensajes" - rechaza cualquier variable
 * `{...}` que no este en la lista blanca
 * (notification-variable-catalog.ts), antes de guardar nada.
 *
 * ALCANCE REAL: esto solo guarda el texto/canal de la plantilla - no
 * dispara ningun envio real (TR-07 sigue sin construirse).
 */
@Injectable()
export class SaveNotificationTemplateHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly templates: NotificationTemplatePort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: SaveNotificationTemplateCommand): Promise<NotificationTemplateSnapshot> {
    const context = await this.workContext.authorize({
      firebaseUid: command.actorFirebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.role, 'MANAGE_NOTIFICATIONS');

    if (!isKnownEventType(command.eventType)) {
      throw new BadRequestException({
        code: 'UNKNOWN_EVENT_TYPE',
        detail: `El evento ${command.eventType} no existe en el catalogo de notificaciones.`,
      });
    }

    if (command.channels.length === 0) {
      throw new BadRequestException({
        code: 'NO_CHANNEL_SELECTED',
        detail: 'La plantilla debe tener al menos un canal seleccionado.',
      });
    }

    const unsafeVariables = findUnsafeVariables(command.body);
    if (unsafeVariables.length > 0) {
      throw new BadRequestException({
        code: 'UNSAFE_VARIABLE',
        detail: `La plantilla no puede usar las variables: ${unsafeVariables.map((v) => `{${v}}`).join(', ')}.`,
      });
    }

    const previous = await this.templates.getCurrent(context.organizationId, command.eventType);

    const created = await this.transactionManager.run(async (tx) => {
      const version = await this.templates.createVersion(
        context.organizationId,
        { eventType: command.eventType, channels: command.channels, body: command.body },
        command.actorFirebaseUid,
        tx,
      );

      await this.auditRepository.recordAdminEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.actorFirebaseUid,
          targetFirebaseUid: command.actorFirebaseUid,
          action: 'NOTIFICATION_TEMPLATE_UPDATED',
          changes: {
            eventType: command.eventType,
            previousVersion: previous?.version ?? null,
            newVersion: version.version,
          },
        },
        tx,
      );

      return version;
    });

    return created;
  }
}
