export class CreateReturnCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly rentalId: string,
    public readonly scheduledAt: Date,
    public readonly notes?: string,
  ) {}
}
