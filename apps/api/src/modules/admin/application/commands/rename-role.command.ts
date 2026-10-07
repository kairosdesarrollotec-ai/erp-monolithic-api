export class RenameRoleCommand {
  constructor(
    public readonly roleId: string,
    public readonly actorFirebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    /** Version del rol que el cliente vio (If-Match). */
    public readonly expectedVersion: number,
    public readonly name: string,
  ) {}
}
