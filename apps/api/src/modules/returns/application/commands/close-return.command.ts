export class CloseReturnCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly signatureData?: string,
    public readonly generateWarrantyAct?: boolean,
    public readonly notes?: string,
  ) {}
}
