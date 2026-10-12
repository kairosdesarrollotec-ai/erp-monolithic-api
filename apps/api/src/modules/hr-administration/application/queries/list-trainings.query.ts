export class ListTrainingsQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly limit?: number,
  ) {}
}
