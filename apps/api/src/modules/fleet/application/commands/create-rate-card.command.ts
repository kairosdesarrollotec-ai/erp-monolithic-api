export class CreateRateCardCommand {
  constructor(
    readonly firebaseUid: string,
    readonly companyId: string,
    readonly branchId: string,
    readonly amountPerDay: number,
    readonly currency: string,
    readonly validityHours: number,
    readonly effectiveFrom: Date,
  ) {}
}
