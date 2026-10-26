export class ConfirmHrDocumentReadCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly documentId: string,
    public readonly companyId: string,
    public readonly branchId: string,
  ) {}
}
