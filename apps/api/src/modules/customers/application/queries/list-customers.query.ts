export class ListCustomersQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly search?: string,
    public readonly limit: number = 50,
    public readonly offset: number = 0,
  ) {}
}
