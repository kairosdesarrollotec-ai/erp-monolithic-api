export class CancelVacationCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly vacationId: string,
    public readonly reason: string,
  ) {}
}
