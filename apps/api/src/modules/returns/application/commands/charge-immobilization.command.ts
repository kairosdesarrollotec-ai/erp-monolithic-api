export class ChargeImmobilizationCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly daysCharged: number,
    public readonly damageId?: string,
    public readonly notes?: string,
  ) {}
}
