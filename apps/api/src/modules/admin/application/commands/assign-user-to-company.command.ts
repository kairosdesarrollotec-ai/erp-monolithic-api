export class AssignUserToCompanyCommand {
  constructor(
    public readonly actorFirebaseUid: string,
    public readonly actorCompanyId: string,
    public readonly actorBranchId: string,
    public readonly targetEmail: string,
    public readonly targetCompanyId: string,
    public readonly targetBranchId: string,
    public readonly targetRoleId: string,
    public readonly initialPassword?: string,
  ) {}
}
