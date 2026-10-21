import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { EvidenceAccessService } from '../services/evidence-access.service';
import { EvidenceDeletionExpirationService } from '../services/evidence-deletion-expiration.service';
import { EvidenceDeletionRequestRepositoryPort } from '../ports/evidence-deletion-request-repository.port';
import { EvidenceDeletionTargetPort } from '../ports/evidence-deletion-target.port';
import {
  EvidenceDeletionInvalidStateError,
  EvidenceDeletionRequestExpiredError,
  EvidenceDeletionRequestNotFoundError,
} from '../../domain/evidence-deletion-errors';
import { assertCanApprove, effectiveDeletionStatus } from '../../domain/evidence-deletion-rules';
import type { EvidenceDeletionRequestRecord } from '../../domain/evidence-deletion-types';
import { ApproveEvidenceDeletionCommand } from './approve-evidence-deletion.command';

/**
 * DEC-EVID-DELETE-002 - aprueba una solicitud. 1a aprobacion: PENDING -> APPROVED_1. 2a aprobacion: APPROVED_1 -> EXECUTED y, en
 * la MISMA transaccion, ejecuta el borrado real de la evidencia (si el expediente ya no lo admite, todo se revierte y la solicitud
 * queda APPROVED_1 hasta que se rechace o venza). Reglas (SDD 15.5): el solicitante no aprueba; el 2o aprobador es distinto del
 * solicitante y del 1o. Cada paso se audita. La transicion es atomica con guarda de estado+version: dos aprobadores simultaneos
 * no pueden saltarse la doble aprobacion (el segundo recibe 409 EVIDENCE_DELETION_INVALID_STATE).
 */
@Injectable()
export class ApproveEvidenceDeletionHandler {
  constructor(
    private readonly access: EvidenceAccessService,
    private readonly requests: EvidenceDeletionRequestRepositoryPort,
    private readonly target: EvidenceDeletionTargetPort,
    private readonly expiration: EvidenceDeletionExpirationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ApproveEvidenceDeletionCommand): Promise<EvidenceDeletionRequestRecord> {
    const { context, scope } = await this.access.authorize(command, 'APPROVE_DELETION');
    const note = command.note?.trim() || null;
    const now = this.clock.now();

    // Vencimiento perezoso: se marca en su propia transaccion (si se hiciera dentro de la que luego falla, se revertiria).
    const probe = await this.requests.findById(command.requestId, scope.organizationId, scope.operatingCompanyId);
    if (!probe) throw new EvidenceDeletionRequestNotFoundError(command.requestId);
    if (effectiveDeletionStatus(probe, now) === 'EXPIRED' && probe.status !== 'EXPIRED') {
      await this.expiration.expireOne(probe, now);
      throw new EvidenceDeletionRequestExpiredError();
    }

    return this.transactionManager.run(async (tx) => {
      const request = await this.requests.findById(command.requestId, scope.organizationId, scope.operatingCompanyId, tx);
      if (!request) throw new EvidenceDeletionRequestNotFoundError(command.requestId);

      const step = assertCanApprove(request, command.firebaseUid);

      if (step === 'FIRST') {
        const updated = await this.requests.transition(
          request.id,
          { statuses: ['PENDING'], version: request.version },
          { status: 'APPROVED_1', firstApprovedBy: command.firebaseUid, firstApprovedAt: now, firstApprovalNote: note },
          tx,
        );
        if (!updated) throw new EvidenceDeletionInvalidStateError('CHANGED');
        await this.auditRepository.recordEvidenceDeletionEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            requestId: request.id,
            action: 'EVIDENCE_DELETION_APPROVED_1',
            changes: { requestedBy: request.requestedBy, note },
          },
          tx,
        );
        return updated;
      }

      const updated = await this.requests.transition(
        request.id,
        { statuses: ['APPROVED_1'], version: request.version },
        { status: 'EXECUTED', secondApprovedBy: command.firebaseUid, secondApprovedAt: now, secondApprovalNote: note, executedAt: now },
        tx,
      );
      if (!updated) throw new EvidenceDeletionInvalidStateError('CHANGED');

      // Ejecutar = el borrado de evidencia ya existente (misma regla de estado del modulo dueño), dentro de esta transaccion.
      await this.target.remove(
        request.targetKind,
        request.parentId,
        request.evidenceId,
        { organizationId: request.organizationId, operatingCompanyId: request.operatingCompanyId, branchId: request.branchId },
        tx,
      );

      await this.auditRepository.recordEvidenceDeletionEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          requestId: request.id,
          action: 'EVIDENCE_DELETION_APPROVED_2',
          changes: { requestedBy: request.requestedBy, firstApprovedBy: request.firstApprovedBy, note },
        },
        tx,
      );
      await this.auditRepository.recordEvidenceDeletionEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          requestId: request.id,
          action: 'EVIDENCE_DELETION_EXECUTED',
          changes: {
            targetKind: request.targetKind,
            parentId: request.parentId,
            evidenceId: request.evidenceId,
            evidence: request.evidenceSnapshot,
            reason: request.reason,
            requestedBy: request.requestedBy,
            firstApprovedBy: request.firstApprovedBy,
            secondApprovedBy: command.firebaseUid,
          },
        },
        tx,
      );
      return updated;
    });
  }
}
