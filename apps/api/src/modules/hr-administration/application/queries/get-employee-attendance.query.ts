export class GetEmployeeAttendanceQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
    public readonly month?: string, // YYYY-MM
    public readonly startDate?: Date,
    public readonly endDate?: Date,
  ) {}
}
