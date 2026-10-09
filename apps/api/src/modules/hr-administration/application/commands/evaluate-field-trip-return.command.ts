export class EvaluateFieldTripReturnCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly fieldTripId: string,
    public readonly actualReturn: Date,
    public readonly returnNotes?: string | null,
  ) {}
}
