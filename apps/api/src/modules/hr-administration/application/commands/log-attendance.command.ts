import type { AttendanceStatus } from '@prisma/client';

export class LogAttendanceCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
    public readonly date: Date,
    public readonly status: AttendanceStatus,
    public readonly minutesLate?: number | null,
    public readonly deductionAmount?: number | null,
    public readonly checkInTime?: Date | null,
    public readonly checkOutTime?: Date | null,
    public readonly notes?: string | null,
  ) {}
}
