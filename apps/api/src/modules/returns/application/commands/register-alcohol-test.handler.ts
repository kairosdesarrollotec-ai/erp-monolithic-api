import { Injectable, Optional } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { AlcoholTestPhotoRequiredError, ReturnNotFoundError, ReturnStateConflictError } from '../../domain/return-errors';
import { RETURN_ALCOHOL_TEST_EVIDENCE_ZONE } from '../../domain/return-evidence-requirements';
import type { WorkerRole } from '../../../users/domain/worker-role';
import { assertCanTransitionReturn } from '../../domain/return-status';
import { RegisterReturnAlcoholTestCommand } from './register-alcohol-test.command';
import { ReturnAlertRecipientsPort } from '../ports/return-alert-recipients.port';
import { ReturnBellNotificationPort } from '../ports/return-bell-notification.port';
import { ReturnDashboardAlertPort } from '../ports/return-dashboard-alert.port';

/**
 * DEV-04 / BR-DEV-005 / DR-DEV-003 - Alcolímetro de salida (tolerancia cero).
 * FAVORABLE -> INSPECCION. DESFAVORABLE/RECHAZADO -> el expediente PERMANECE en RECEPCION_PROVISIONAL, el
 * vehículo sigue en custodia preventiva de VeloxRent y se escala a Gerencia (evento EscaladoAGerencia.v1). El
 * comando no falla en ese caso: el resultado queda registrado (200).
 * Fiorella 2026-10-16: DESFAVORABLE = check "no cumple rango" + FOTO de la prueba obligatoria (evidencia PHOTO con zona
 * ALCOHOL_TEST subida antes); sin foto -> 422 ALCOHOL_TEST_PHOTO_REQUIRED. No se registra hora ni otros campos.
 * RECHAZADO (16/19-oct, Russbel): la foto de la prueba tambien se sube y es obligatoria, como evidencia "por si acaso".
 */
@Injectable()
export class RegisterReturnAlcoholTestHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    @Optional() private readonly recipients?: ReturnAlertRecipientsPort,
    @Optional() private readonly dashboardAlerts?: ReturnDashboardAlertPort,
    @Optional() private readonly bell?: ReturnBellNotificationPort,
  ) {}

  async execute(command: RegisterReturnAlcoholTestCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'REGISTER_ALCOHOL_TEST');

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }
    if (existing.status !== 'RECEPCION_PROVISIONAL') {
      throw new ReturnStateConflictError('registrar alcolímetro en', existing.status);
    }

    const passing = command.result === 'FAVORABLE';

    return this.transactionManager.run(async (tx) => {
      const current = await this.returns.findById(command.id, scope, tx);
      if (!current) {
        throw new ReturnNotFoundError(command.id);
      }
      if (current.status !== 'RECEPCION_PROVISIONAL') {
        throw new ReturnStateConflictError('registrar alcolímetro en', current.status);
      }
      if (passing) {
        assertCanTransitionReturn(current.status, 'INSPECCION');
      }
      let alcoholPhotoEvidenceId: string | undefined;
      if (command.result === 'DESFAVORABLE' || command.result === 'RECHAZADO') {
        const evidences = await this.returns.listEvidences(command.id, scope);
        const photo = evidences.find((e) => e.type === 'PHOTO' && e.zone === RETURN_ALCOHOL_TEST_EVIDENCE_ZONE);
        if (!photo) {
          throw new AlcoholTestPhotoRequiredError();
        }
        alcoholPhotoEvidenceId = photo.id;
      }

      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          status: passing ? 'INSPECCION' : undefined,
          custodyHolder: 'VELOXRENT',
          alcoholTestResult: command.result,
          alcoholTestNotes: command.notes,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: passing ? 'RETURN_ALCOHOL_TEST_PASSED' : 'RETURN_ALCOHOL_TEST_FAILED_ESCALATED',
          changes: {
            returnId: updated.id,
            result: command.result,
            notes: command.notes,
            alcoholPhotoEvidenceId,
            newStatus: updated.status,
            escalatedTo: passing ? undefined : 'GERENCIA',
          },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: updated.id,
          eventType: passing ? 'DevolucionAlcoholFavorable.v1' : 'EscaladoAGerencia.v1',
          payload: {
            returnId: updated.id,
            rentalId: updated.rentalId,
            result: command.result,
            alcoholPhotoEvidenceId: alcoholPhotoEvidenceId ?? null,
            status: updated.status,
            escalatedTo: passing ? null : 'GERENCIA',
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      if (!passing) {
        await this.notifyManagement(updated, command.result, context.organizationId, command.companyId, command.branchId);
      }

      return updated;
    });
  }

  /**
   * H-02 (decisión de negocio 28-oct #4): la derivación a Gerencia por alcolímetro desfavorable/rechazado llega a la campana y
   * al tablero de Gerencia y de los roles con el permiso de alertas de devolución. No bloqueante: un fallo no revierte el registro.
   */
  private async notifyManagement(
    updated: ReturnRecord,
    result: string,
    organizationId: string,
    companyId: string,
    branchId: string,
  ): Promise<void> {
    if (!this.recipients) return;
    try {
      const scope = { organizationId, operatingCompanyId: companyId, branchId };
      const roles = new Set<WorkerRole>(await this.recipients.rolesWithAlertPermission(scope));
      roles.add('GERENCIA');
      const plate = updated.vehiclePlate ?? 'Vehículo';
      const title = `Alcolímetro ${result === 'RECHAZADO' ? 'rechazado' : 'desfavorable'} — ${plate}`;
      const detail = `La devolución quedó en custodia preventiva y requiere decisión de Gerencia (BR-DEV-005).`;
      const deepLink = `/devoluciones/${updated.id}/alcoholimetro`;
      if (this.dashboardAlerts) {
        await this.dashboardAlerts.createDashboardItems(
          Array.from(roles).map((role) => ({
            organizationId,
            operatingCompanyId: companyId,
            branchId,
            role,
            itemType: 'ALERT' as const,
            priority: 95,
            title,
            detail,
            deepLink,
            sourceType: 'RETURN' as const,
            sourceId: updated.id,
            sourceEventId: `return-alcohol-escalation:${updated.id}:${role}`,
          })),
        );
      }
      await this.bell?.notifyRoles({
        organizationId,
        operatingCompanyId: companyId,
        branchId,
        roles: Array.from(roles),
        notificationType: 'RETURN_ALCOHOL_ESCALATED',
        title,
        deepLink,
        sourceEventPrefix: `return-alcohol-escalation-bell:${updated.id}`,
      });
    } catch {
      // no bloqueante
    }
  }
}
