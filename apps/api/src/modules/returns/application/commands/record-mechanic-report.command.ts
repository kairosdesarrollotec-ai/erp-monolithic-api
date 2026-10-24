export class RecordMechanicReportCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly accepted: boolean,
    public readonly notes?: string,
  ) {}
}
