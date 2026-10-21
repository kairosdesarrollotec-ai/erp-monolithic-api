import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { EvidenceAccessService } from '../services/evidence-access.service';
import { EvidenceDeletionExpirationService } from '../services/evidence-deletion-expiration.service';
import { EvidenceDeletionRequestRepositoryPort } from '../ports/evidence-deletion-request-repository.port';
import { EvidenceDeletionTargetPort } from '../ports/evidence-deletion-target.port';
import { EvidenceDeletionAlreadyRequestedError } from '../../domain/evidence-deletion-errors';
import { computeEvidenceDeletionExpiry, effectiveDeletionStatus, normalizeDeletionReason } from '../../domain/evidence-deletion-rules';
import type { EvidenceDeletionRequestRecord } from '../../domain/evidence-deletion-types';
import { RequestEvidenceDeletionCommand } from './request-evidence-deletion.command';

/**
 * DEC-EVID-DELETE-002 - abre la solicitud de eliminacion de una evidencia (nada se borra aqui). Exige EVIDENCE.REQUEST_DELETION,
 * motivo obligatorio y que la evidencia exista y siga siendo eliminable (mismas reglas de estado del modulo dueño). Una sola
 * solicitud abierta por evidencia. Audita EVIDENCE_DELETION_REQUESTED.
 */
@Injectable()
export class RequestEvidenceDeletionHandler {
  constructor(
    private readonly access: EvidenceAccessService,
    private readonly requests: EvidenceDeletionRequestRepositoryPort,
    private readonly target: EvidenceDeletionTargetPort,
    private readonly expiration: EvidenceDeletionExpirationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RequestEvidenceDeletionCommand): Promise<EvidenceDeletionRequestRecord> {
    const { context, scope } = await this.access.authorize(command, 'REQUEST_DELETION');
    const reason = normalizeDeletionReason(command.reason);
    const now = this.clock.now();

    return this.transactionManager.run(async (tx) => {
      const snapshot = await this.target.locate(command.targetKind, command.targetId, command.evidenceId, scope, tx);

      const open = await this.requests.findOpenByEvidence(command.targetKind, command.evidenceId, scope.organizationId, tx);
      if (open) {
        // Vencida pero aun sin marcar por el job: se marca y se permite la nueva; vigente -> 409.
        if (effectiveDeletionStatus(open, now) === 'EXPIRED') {
          await this.expiration.expireOne(open, now, tx);
        } else {
          throw new EvidenceDeletionAlreadyRequestedError(open.id);
        }
      }

      const created = await this.requests.create(
        {
          ...scope,
          targetKind: command.targetKind,
          parentId: command.targetId,
          evidenceId: command.evidenceId,
          evidenceSnapshot: snapshot,
          reason,
          requestedBy: command.firebaseUid,
          requestedAt: now,
          expiresAt: computeEvidenceDeletionExpiry(now),
        },
        tx,
      );

      await this.auditRepository.recordEvidenceDeletionEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          requestId: created.id,
          action: 'EVIDENCE_DELETION_REQUESTED',
          changes: {
            targetKind: created.targetKind,
            parentId: created.parentId,
            evidenceId: created.evidenceId,
            reason: created.reason,
            expiresAt: created.expiresAt.toISOString(),
            evidence: { type: snapshot.type, zone: snapshot.zone },
          },
        },
        tx,
      );
      return created;
    });
  }
}
