export class RequestReservationAirportServiceCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly scheduledAt: Date,
    public readonly location: string,
    public readonly additionalAmount: string,
    public readonly notes?: string,
  ) {}
}
