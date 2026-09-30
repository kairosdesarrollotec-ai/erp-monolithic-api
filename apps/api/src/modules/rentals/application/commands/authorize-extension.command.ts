export class AuthorizeExtensionCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly paymentId?: string,
    public readonly addendumDocumentRef?: string,
  ) {}
}
