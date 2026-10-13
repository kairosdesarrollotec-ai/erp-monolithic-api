export class RegisterTrainingCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly topic: string,
    public readonly heldOn: Date,
    public readonly attendeeIds: string[],
    public readonly durationMinutes?: number,
    public readonly comprehensionNotes?: string | null,
  ) {}
}
