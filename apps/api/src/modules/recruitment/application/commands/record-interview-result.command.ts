import { InterviewResult } from '@prisma/client';

export class RecordInterviewResultCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly id: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly result: InterviewResult,
    public readonly qualitativeNotes: string,
  ) {}
}
