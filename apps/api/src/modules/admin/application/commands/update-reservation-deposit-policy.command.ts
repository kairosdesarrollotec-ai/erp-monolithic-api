export class UpdateReservationDepositPolicyCommand {
  constructor(
    public readonly actorFirebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly amount: string,
    public readonly currency: string,
  ) {}
}
