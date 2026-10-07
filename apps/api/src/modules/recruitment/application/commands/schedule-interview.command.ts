export class ScheduleInterviewCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly candidateId: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly scheduledAt: Date,
    public readonly isVirtual: boolean,
    public readonly interviewerId: string,
    public readonly meetUrl?: string | null,
    public readonly location?: string | null,
  ) {}
}
