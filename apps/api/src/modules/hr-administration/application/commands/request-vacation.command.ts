export class RequestVacationCommand {
  constructor(
    readonly firebaseUid: string,
    readonly employeeId: string,
    readonly startDate: Date,
    readonly endDate: Date,
    readonly notes?: string | null,
  ) {}
}
