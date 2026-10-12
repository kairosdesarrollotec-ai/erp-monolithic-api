export class ReclassifyAttendanceCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly attendanceId: string,
    public readonly status: string,
    public readonly justification: string,
  ) {}
}
