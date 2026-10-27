export class RegisterReturnFuelPenaltyCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly amount: number,
    public readonly reason: string,
  ) {}
}
