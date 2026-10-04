export class FormalizeContractCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly templateVersionId: string | undefined,
    public readonly documentRef: string,
    public readonly depositAmount: string,
    public readonly depositCurrency: string,
    public readonly signatureData?: string,
  ) {}
}
