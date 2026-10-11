export class RequestFieldTripCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
    public readonly destination: string,
    public readonly objective: string,
    public readonly estimatedDeparture: Date,
    public readonly estimatedReturn: Date,
  ) {}
}
