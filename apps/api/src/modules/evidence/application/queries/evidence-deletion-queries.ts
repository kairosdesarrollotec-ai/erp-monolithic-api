import type { EvidenceDeletionStatus, EvidenceDeletionTargetKind } from '../../domain/evidence-deletion-types';

export class ListEvidenceDeletionRequestsQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly status?: EvidenceDeletionStatus,
    public readonly targetKind?: EvidenceDeletionTargetKind,
    public readonly limit?: number,
  ) {}
}

export class GetEvidenceDeletionRequestQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly requestId: string,
  ) {}
}
