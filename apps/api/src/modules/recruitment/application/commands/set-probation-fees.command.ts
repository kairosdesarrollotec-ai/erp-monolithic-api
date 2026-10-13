export class SetProbationFeesCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly candidateId: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly probationMonthlyFee: number,
    public readonly postProbationMonthlySalary?: number,
    public readonly probationFeeNotes?: string,
  ) {}
}
