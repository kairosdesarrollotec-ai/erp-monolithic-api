import type { LeaveType } from '@prisma/client';

export class RequestLeaveCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
    public readonly type: LeaveType,
    public readonly date: Date,
    public readonly reason: string,
    public readonly startTime?: Date | null,
    public readonly endTime?: Date | null,
  ) {}
}
