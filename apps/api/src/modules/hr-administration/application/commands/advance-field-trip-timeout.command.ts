export class AdvanceFieldTripTimeoutCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly fieldTripId: string,
  ) {}
}
