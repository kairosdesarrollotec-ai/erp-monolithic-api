import { Injectable, Optional } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnNotFoundError } from '../../domain/return-errors';
import { ReturnDashboardAlertPort } from '../ports/return-dashboard-alert.port';
import { RecordHolderNotificationCommand } from './record-holder-notification.command';

/**
 * SC-DEV-004.01 / EX-DEV-001 - Notificación formal al titular ausente al día siguiente
 * de la recepción vehicular efectuada por un tercero.
 */
@Injectable()
export class RecordHolderNotificationHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    @Optional() private readonly dashboardAlerts?: ReturnDashboardAlertPort,
  ) {}

  async execute(command: RecordHolderNotificationCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'COMPLETE_INSPECTION');

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }

    return this.transactionManager.run(async (tx) => {
      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion ?? existing.version,
          holderNotificationSent: true,
          holderNotificationSentAt: command.contactedAt,
          holderNotificationSentBy: command.notifiedBy,
          holderNotificationChannel: command.channel,
          holderNotificationNotes: command.observations?.trim() || null,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: 'RETURN_HOLDER_NOTIFICATION_RECORDED',
          changes: {
            returnId: updated.id,
            channel: command.channel,
            contactedAt: command.contactedAt.toISOString(),
            notifiedBy: command.notifiedBy,
            observations: command.observations ?? null,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: updated.id,
          eventType: 'NotificacionTitularAusenteRegistrada.v1',
          payload: {
            returnId: updated.id,
            rentalId: updated.rentalId,
            channel: command.channel,
            contactedAt: command.contactedAt.toISOString(),
            notifiedBy: command.notifiedBy,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      if (this.dashboardAlerts) {
        const active = await this.dashboardAlerts.listActiveItems(
          `return-holder-notification:${updated.id}`,
          10,
        ).catch(() => []);
        if (active && active.length > 0) {
          await this.dashboardAlerts.dismissItems(
            active.map((item) => item.id),
            new Date(),
          ).catch(() => undefined);
        }
      }

      return updated;
    });
  }
}
