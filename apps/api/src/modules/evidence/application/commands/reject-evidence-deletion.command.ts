export class RejectEvidenceDeletionCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly requestId: string,
    public readonly reason: string,
  ) {}
}
