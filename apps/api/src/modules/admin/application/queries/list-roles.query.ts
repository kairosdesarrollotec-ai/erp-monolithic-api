export class ListRolesQuery {
  constructor(
    public readonly actorFirebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly includeInactive: boolean,
  ) {}
}
