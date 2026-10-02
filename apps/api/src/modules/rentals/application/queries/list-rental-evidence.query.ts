export class ListRentalEvidenceQuery {
  constructor(
    public readonly rentalId: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
  ) {}
}
