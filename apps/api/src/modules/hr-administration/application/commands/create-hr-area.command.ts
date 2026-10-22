export class CreateHrAreaCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly name: string,
    public readonly description?: string | null,
  ) {}
}
