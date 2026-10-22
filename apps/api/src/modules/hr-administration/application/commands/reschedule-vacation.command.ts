export class RescheduleVacationCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly vacationId: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly reason: string,
  ) {}
}
