export class CreateRoleCommand {
  constructor(
    public readonly actorFirebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly name: string,
  ) {}
}
