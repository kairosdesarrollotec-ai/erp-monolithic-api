export class GetRolePermissionMatrixQuery {
  constructor(
    public readonly actorFirebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    /** Ambito a mostrar (opcional; omitido = toda la organizacion). */
    public readonly scopeCompanyId?: string | null,
    public readonly scopeBranchId?: string | null,
  ) {}
}
