import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { EvidenceAccessService } from '../services/evidence-access.service';
import { EvidenceDeletionRequestRepositoryPort } from '../ports/evidence-deletion-request-repository.port';
import { EvidenceDeletionRequestNotFoundError } from '../../domain/evidence-deletion-errors';
import { GetEvidenceDeletionRequestQuery } from './evidence-deletion-queries';
import { EvidenceDeletionRequestView, toDeletionView } from './evidence-deletion-view';

@Injectable()
export class GetEvidenceDeletionRequestHandler {
  constructor(
    private readonly access: EvidenceAccessService,
    private readonly requests: EvidenceDeletionRequestRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: GetEvidenceDeletionRequestQuery): Promise<EvidenceDeletionRequestView> {
    const { scope, canApprove } = await this.access.authorizeView(query);
    const found = await this.requests.findById(query.requestId, scope.organizationId, scope.operatingCompanyId);
    if (!found) throw new EvidenceDeletionRequestNotFoundError(query.requestId);
    return toDeletionView(found, query.firebaseUid, canApprove, this.clock.now());
  }
}
