import type { EvidenceDeletionTargetKind } from '../../domain/evidence-deletion-types';

export class RequestEvidenceDeletionCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly targetKind: EvidenceDeletionTargetKind,
    public readonly targetId: string,
    public readonly evidenceId: string,
    public readonly reason: string,
  ) {}
}
