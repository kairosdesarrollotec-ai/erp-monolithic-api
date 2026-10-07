import { CandidateStage } from '@prisma/client';

export class ChangeCandidateStageCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly id: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly stage: CandidateStage,
    public readonly expectedVersion: number,
  ) {}
}
