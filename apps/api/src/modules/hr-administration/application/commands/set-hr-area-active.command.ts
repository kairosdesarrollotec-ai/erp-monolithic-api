export class SetHrAreaActiveCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly code: string,
    public readonly isActive: boolean,
  ) {}
}
