export class QuoteCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly vehicleId: string,
    public readonly destination: string,
    public readonly estimatedDays: number,
  ) {}
}
