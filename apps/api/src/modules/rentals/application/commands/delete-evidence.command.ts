export class DeleteEvidenceCommand {
  constructor(
    public readonly rentalId: string,
    public readonly evidenceId: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
  ) {}
}
