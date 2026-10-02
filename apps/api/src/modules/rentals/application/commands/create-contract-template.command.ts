export class CreateContractTemplateCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly type: string,
    public readonly effectiveFrom?: Date,
  ) {}
}
