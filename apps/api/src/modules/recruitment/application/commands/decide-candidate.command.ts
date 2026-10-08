import { CandidateDecision } from '@prisma/client';

export class DecideCandidateCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly id: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly decision: CandidateDecision,
    public readonly expectedVersion: number,
    public readonly decisionNotes?: string | null,
  ) {}
}
