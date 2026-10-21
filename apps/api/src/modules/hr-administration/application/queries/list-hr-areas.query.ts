export class ListHrAreasQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    /** Solo quien tiene MANAGE_AREAS (Gerencia) puede pedir tambien las inactivas. */
    public readonly includeInactive: boolean = false,
  ) {}
}
