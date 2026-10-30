import { Injectable, Optional } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnNotFoundError } from '../../domain/return-errors';
import { RecordMechanicReportCommand } from './record-mechanic-report.command';
import { ReturnCustomerRiskPort } from '../ports/return-customer-risk.port';
import { ReturnDashboardAlertPort } from '../ports/return-dashboard-alert.port';
import { ReturnBellNotificationPort } from '../ports/return-bell-notification.port';

/**
 * DEC-DEV-REPORT-001 (23-oct-2026, Frente C):
 * Registra la aceptación del informe mecánico/Motrix por el cliente para daños.
 */
@Injectable()
export class RecordMechanicReportHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    @Optional() private readonly customerRisk?: ReturnCustomerRiskPort,
    @Optional() private readonly dashboardAlerts?: ReturnDashboardAlertPort,
    @Optional() private readonly bell?: ReturnBellNotificationPort,
  ) {}

  async execute(command: RecordMechanicReportCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'CLOSE');

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }

    const now = this.clock.now();

    const result = await this.transactionManager.run(async (tx) => {
      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          mechanicReportAccepted: command.accepted,
          mechanicReportAcceptedAt: now,
          mechanicReportAcceptedBy: command.firebaseUid,
          mechanicReportNotes: command.notes?.trim() || null,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      // Decisión de negocio 28-oct: el cliente que rechaza el informe pasa a AMBAR y Gerencia decide cómo queda.
      const risk =
        !command.accepted && this.customerRisk
          ? await this.customerRisk.escalate(
              {
                customerId: updated.customerId,
                organizationId: context.organizationId,
                operatingCompanyId: scope.operatingCompanyId,
                target: 'AMBAR',
                reason: 'El cliente rechazó el informe mecánico de daños.',
              },
              tx,
            )
          : null;

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: 'RETURN_MECHANIC_REPORT_RECORDED',
          changes: {
            returnId: updated.id,
            accepted: command.accepted,
            notes: command.notes,
            recordedAt: now,
            customerRiskStatus: risk?.current,
            customerRiskPrevious: risk?.previous,
          },
        },
        tx,
      );

      return updated;
    });

    if (!command.accepted) {
      await this.notifyManagement(result, context.organizationId, command.companyId, command.branchId);
    }
    return result;
  }

  /** El rechazo del informe se escala a Gerencia (tablero + campana). No bloqueante. */
  private async notifyManagement(updated: ReturnRecord, organizationId: string, companyId: string, branchId: string): Promise<void> {
    try {
      const plate = updated.vehiclePlate ?? 'Vehículo';
      const title = `Cliente rechazó el informe de daños — ${plate}`;
      const detail = 'El cliente quedó en ÁMBAR; Gerencia debe decidir cómo continúa (vía legal u otra salida).';
      const deepLink = `/devoluciones/${updated.id}/cierre`;
      if (this.dashboardAlerts) {
        await this.dashboardAlerts.createDashboardItems([
          {
            organizationId,
            operatingCompanyId: companyId,
            branchId,
            role: 'GERENCIA',
            itemType: 'ALERT' as const,
            priority: 90,
            title,
            detail,
            deepLink,
            sourceType: 'RETURN' as const,
            sourceId: updated.id,
            sourceEventId: `return-report-rejected:${updated.id}:GERENCIA`,
          },
        ]);
      }
      await this.bell?.notifyRoles({
        organizationId,
        operatingCompanyId: companyId,
        branchId,
        roles: ['GERENCIA'],
        notificationType: 'RETURN_REPORT_REJECTED',
        title,
        deepLink,
        sourceEventPrefix: `return-report-rejected-bell:${updated.id}`,
        isEscalated: true,
      });
    } catch {
      // no bloqueante
    }
  }
}
