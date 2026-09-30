export class CreateRentalCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly customerId: string,
    public readonly vehicleId: string,
    public readonly planCode?: string,
    public readonly startAt?: Date,
    public readonly expectedEndAt?: Date,
    public readonly inquiryId?: string,
  ) {}
}
