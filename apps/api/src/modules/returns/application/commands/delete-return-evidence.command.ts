export class DeleteReturnEvidenceCommand {
  constructor(
    public readonly returnId: string,
    public readonly evidenceId: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
  ) {}
}
