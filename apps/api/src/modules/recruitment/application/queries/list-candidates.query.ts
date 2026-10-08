import { CandidateStage } from '@prisma/client';

export class ListCandidatesQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly vacancyId: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly stage?: CandidateStage,
  ) {}
}
