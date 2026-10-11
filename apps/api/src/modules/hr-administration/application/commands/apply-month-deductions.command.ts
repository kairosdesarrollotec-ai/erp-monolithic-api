export class ApplyMonthDeductionsCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly payrollMonth: string, // YYYY-MM
    public readonly employeeIds?: string[],
  ) {}
}
