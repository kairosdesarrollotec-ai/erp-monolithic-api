export class ScheduleVacationCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly notes?: string | null,
  ) {}
}
