import { Injectable, Optional } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import {
  MissingReturnEvidenceError,
  ReturnNotFoundError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import { resolveResponsibilityDocument } from '../../domain/responsibility-document';
import { missingReturnEvidence } from '../../domain/return-evidence-requirements';
import { appendNotes } from '../../domain/return-rules';
import { assertCanTransitionReturn, ReturnStatus } from '../../domain/return-status';
import { ReturnDashboardAlertPort } from '../ports/return-dashboard-alert.port';
import { SyncClosureGatePort } from '../../../sync-conflicts/application/ports/sync-closure-gate.port';
import { CompleteInspectionCommand } from './complete-inspection.command';

/**
 * DEV-04 / DEV-05 / BR-DEV-009 - Completa el checklist de retorno. Exige la evidencia fotográfica/audiovisual
 * mínima registrada y clasifica el expediente en SIN_DANOS o CON_DANOS.
 * Exige el documento de responsabilidad firmado (BR-DEV-009, DAT-DEV-005, EX-DEV-001; validez jurídica pendiente de Legal).
 * No se registra signatureData en audit/outbox (solo metadatos).
 */
@Injectable()
export class CompleteInspectionHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    /**
     * TR-08 / DEV-04: el cierre de la inspeccion ("Continuar a Resultado") queda bloqueado mientras el checklist offline
     * tenga conflictos de sincronizacion sin resolver (409 SYNC_CONFLICT_PENDING). Opcional solo para los specs previos.
     */
    @Optional() private readonly syncGate?: SyncClosureGatePort,
    @Optional() private readonly dashboardAlerts?: ReturnDashboardAlertPort,
  ) {}

  async execute(command: CompleteInspectionCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'COMPLETE_INSPECTION');

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }
    if (existing.status !== 'INSPECCION') {
      throw new ReturnStateConflictError('completar la inspección de', existing.status);
    }

    await this.syncGate?.assertSynced('RECEPCION', command.id, scope);

    // BR-DEV-009 / DAT-DEV-005: sin documento de responsabilidad firmado no se completa la inspección (422).
    const responsibility = resolveResponsibilityDocument(command.responsibilityDocument);

    const target: ReturnStatus = command.hasDamages ? 'CON_DANOS' : 'SIN_DANOS';
    const now = this.clock.now();

    return this.transactionManager.run(async (tx) => {
      const current = await this.returns.findById(command.id, scope, tx);
      if (!current) {
        throw new ReturnNotFoundError(command.id);
      }
      if (current.status !== 'INSPECCION') {
        throw new ReturnStateConflictError('completar la inspección de', current.status);
      }
      assertCanTransitionReturn(current.status, target);
      await this.syncGate?.assertSynced('RECEPCION', command.id, scope, tx);

      const counts = await this.returns.countEvidenceByType(command.id, scope, tx);
      const missing = missingReturnEvidence(counts);
      if (missing.length > 0) {
        throw new MissingReturnEvidenceError(missing);
      }

      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          status: target,
          inspectedAt: now,
          responsibilitySignerName: responsibility.signerName,
          responsibilitySignerIsHolder: responsibility.signerIsHolder,
          responsibilitySignerRelation: responsibility.signerRelationToHolder ?? undefined,
          responsibilitySignatureData: responsibility.signatureData,
          responsibilitySignedAt: now,
          notes: appendNotes(
            current.notes,
            command.notes,
            command.hasDamages && command.damagesDescription ? `Daños observados: ${command.damagesDescription}` : undefined,
          ),
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: 'RETURN_INSPECTION_COMPLETED',
          changes: {
            returnId: updated.id,
            hasDamages: command.hasDamages,
            newStatus: target,
            photosCount: counts.photos,
            videosCount: counts.videos,
            responsibilitySignerIsHolder: responsibility.signerIsHolder,
            responsibilitySignerRelation: responsibility.signerRelationToHolder ?? undefined,
          },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: updated.id,
          eventType: 'InspeccionRetornoCompletada.v1',
          payload: {
            returnId: updated.id,
            rentalId: updated.rentalId,
            hasDamages: command.hasDamages,
            status: target,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      if (!responsibility.signerIsHolder && this.dashboardAlerts) {
        await this.dashboardAlerts.createDashboardItems([
          {
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
            role: 'FRONT_OFFICE',
            itemType: 'ALERT',
            priority: 70,
            title: 'Notificar formalmente al titular ausente',
            detail: `Vehículo recibido por ${responsibility.signerName} (${responsibility.signerRelationToHolder || 'tercero'}). Notificar formalmente al titular al día siguiente (SC-DEV-004.01).`,
            deepLink: `/devoluciones/${updated.id}/cierre`,
            sourceType: 'RETURN',
            sourceId: updated.id,
            sourceEventId: `return-holder-notification:${updated.id}`,
          },
        ]).catch(() => undefined);
      }

      return updated;
    });
  }
}
