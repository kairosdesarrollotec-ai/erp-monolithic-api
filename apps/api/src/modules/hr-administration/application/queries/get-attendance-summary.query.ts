export class GetAttendanceSummaryQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly month: string, // YYYY-MM
  ) {}
}
