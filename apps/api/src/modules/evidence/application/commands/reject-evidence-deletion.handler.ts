import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { EvidenceAccessService } from '../services/evidence-access.service';
import { EvidenceDeletionExpirationService } from '../services/evidence-deletion-expiration.service';
import { EvidenceDeletionRequestRepositoryPort } from '../ports/evidence-deletion-request-repository.port';
import {
  EvidenceDeletionInvalidStateError,
  EvidenceDeletionRequestExpiredError,
  EvidenceDeletionRequestNotFoundError,
} from '../../domain/evidence-deletion-errors';
import { assertCanReject, effectiveDeletionStatus, normalizeDeletionReason } from '../../domain/evidence-deletion-rules';
import { EVIDENCE_DELETION_OPEN_STATUSES, type EvidenceDeletionRequestRecord } from '../../domain/evidence-deletion-types';
import { RejectEvidenceDeletionCommand } from './reject-evidence-deletion.command';

/**
 * DEC-EVID-DELETE-002 - rechaza una solicitud abierta (PENDING o APPROVED_1) con motivo obligatorio. Exige
 * EVIDENCE.APPROVE_DELETION; el solicitante no puede rechazar la suya. La evidencia no se toca. Audita EVIDENCE_DELETION_REJECTED.
 */
@Injectable()
export class RejectEvidenceDeletionHandler {
  constructor(
    private readonly access: EvidenceAccessService,
    private readonly requests: EvidenceDeletionRequestRepositoryPort,
    private readonly expiration: EvidenceDeletionExpirationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RejectEvidenceDeletionCommand): Promise<EvidenceDeletionRequestRecord> {
    const { context, scope } = await this.access.authorize(command, 'APPROVE_DELETION');
    const reason = normalizeDeletionReason(command.reason, 'El rechazo de la solicitud');
    const now = this.clock.now();

    const probe = await this.requests.findById(command.requestId, scope.organizationId, scope.operatingCompanyId);
    if (!probe) throw new EvidenceDeletionRequestNotFoundError(command.requestId);
    if (effectiveDeletionStatus(probe, now) === 'EXPIRED' && probe.status !== 'EXPIRED') {
      await this.expiration.expireOne(probe, now);
      throw new EvidenceDeletionRequestExpiredError();
    }

    return this.transactionManager.run(async (tx) => {
      const request = await this.requests.findById(command.requestId, scope.organizationId, scope.operatingCompanyId, tx);
      if (!request) throw new EvidenceDeletionRequestNotFoundError(command.requestId);
      assertCanReject(request, command.firebaseUid);

      const updated = await this.requests.transition(
        request.id,
        { statuses: EVIDENCE_DELETION_OPEN_STATUSES, version: request.version },
        { status: 'REJECTED', rejectedBy: command.firebaseUid, rejectedAt: now, rejectionReason: reason },
        tx,
      );
      if (!updated) throw new EvidenceDeletionInvalidStateError('CHANGED');

      await this.auditRepository.recordEvidenceDeletionEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          requestId: request.id,
          action: 'EVIDENCE_DELETION_REJECTED',
          changes: { previousStatus: request.status, requestedBy: request.requestedBy, reason },
        },
        tx,
      );
      return updated;
    });
  }
}
