export class RejectFieldTripCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly fieldTripId: string,
    public readonly reason: string,
  ) {}
}
