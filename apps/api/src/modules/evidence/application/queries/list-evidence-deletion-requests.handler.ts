import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { EvidenceAccessService } from '../services/evidence-access.service';
import { EvidenceDeletionRequestRepositoryPort } from '../ports/evidence-deletion-request-repository.port';
import { ListEvidenceDeletionRequestsQuery } from './evidence-deletion-queries';
import { EvidenceDeletionRequestView, toDeletionView } from './evidence-deletion-view';

export const DEFAULT_EVIDENCE_DELETION_LIST_LIMIT = 50;
export const MAX_EVIDENCE_DELETION_LIST_LIMIT = 200;

/** Lista las solicitudes de la empresa del usuario (mas recientes primero). Exige poder solicitar o aprobar. */
@Injectable()
export class ListEvidenceDeletionRequestsHandler {
  constructor(
    private readonly access: EvidenceAccessService,
    private readonly requests: EvidenceDeletionRequestRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: ListEvidenceDeletionRequestsQuery): Promise<EvidenceDeletionRequestView[]> {
    const { scope, canApprove } = await this.access.authorizeView(query);
    const now = this.clock.now();
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_EVIDENCE_DELETION_LIST_LIMIT, 1), MAX_EVIDENCE_DELETION_LIST_LIMIT);
    const rows = await this.requests.list({
      organizationId: scope.organizationId,
      operatingCompanyId: scope.operatingCompanyId,
      status: query.status,
      targetKind: query.targetKind,
      now,
      limit,
    });
    return rows.map((row) => toDeletionView(row, query.firebaseUid, canApprove, now));
  }
}
