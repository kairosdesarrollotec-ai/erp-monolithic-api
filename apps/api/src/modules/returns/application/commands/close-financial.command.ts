export class CloseFinancialCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly refundAmount: number,
    public readonly retainedAmount: number,
    public readonly notes?: string,
  ) {}
}
