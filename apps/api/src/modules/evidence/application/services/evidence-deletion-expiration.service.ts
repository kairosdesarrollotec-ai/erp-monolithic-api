import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { EvidenceDeletionRequestRepositoryPort } from '../ports/evidence-deletion-request-repository.port';
import { EVIDENCE_DELETION_OPEN_STATUSES, type EvidenceDeletionRequestRecord } from '../../domain/evidence-deletion-types';

export const EVIDENCE_DELETION_EXPIRY_BATCH = 200;

/**
 * Vencimiento de solicitudes abiertas (PENDING / APPROVED_1) cuya vigencia paso sin completar la doble aprobacion. Lo usan el
 * job periodico y, de forma perezosa, los handlers de aprobar / rechazar. Siempre audita (actor null = sistema).
 */
@Injectable()
export class EvidenceDeletionExpirationService {
  constructor(
    private readonly requests: EvidenceDeletionRequestRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  /** Marca EXPIRED una solicitud (idempotente: si otro actor la cambio antes, no hace nada). */
  async expireOne(request: EvidenceDeletionRequestRecord, now: Date, tx?: Prisma.TransactionClient): Promise<boolean> {
    const run = async (client: Prisma.TransactionClient): Promise<boolean> => {
      const updated = await this.requests.transition(
        request.id,
        { statuses: EVIDENCE_DELETION_OPEN_STATUSES, version: request.version },
        { status: 'EXPIRED', expiredAt: now },
        client,
      );
      if (!updated) return false;
      await this.auditRepository.recordEvidenceDeletionEvent(
        {
          organizationId: request.organizationId,
          actorUserId: null,
          requestId: request.id,
          action: 'EVIDENCE_DELETION_EXPIRED',
          changes: { previousStatus: request.status, expiresAt: request.expiresAt.toISOString(), targetKind: request.targetKind, evidenceId: request.evidenceId },
        },
        client,
      );
      return true;
    };
    return tx ? run(tx) : this.transactionManager.run(run);
  }

  /** Job: vence todo lo vencido (por lotes). Devuelve cuantas marco. */
  async expireDue(now: Date): Promise<number> {
    let expired = 0;
    for (let batch = 0; batch < 10; batch += 1) {
      const due = await this.requests.findDueOpen(now, EVIDENCE_DELETION_EXPIRY_BATCH);
      if (due.length === 0) break;
      for (const request of due) {
        if (await this.expireOne(request, now)) expired += 1;
      }
      if (due.length < EVIDENCE_DELETION_EXPIRY_BATCH) break;
    }
    return expired;
  }
}
