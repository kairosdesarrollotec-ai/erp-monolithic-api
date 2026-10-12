export class CloseFinancialCommand {
  constructor(
    readonly depositId: string,
    readonly firebaseUid: string,
    readonly companyId: string,
    readonly branchId: string,
    readonly retainedAmount: number,
    readonly notes: string,
  ) {}
}
