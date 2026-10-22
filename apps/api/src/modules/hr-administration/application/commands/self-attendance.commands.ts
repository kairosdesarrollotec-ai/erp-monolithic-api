import type { AttendanceEvidenceInput } from './log-attendance.command';

export type SelfAttendanceType = 'CHECK_IN' | 'CHECK_OUT';

/** 22-oct (#9): marca propia de asistencia (POST /me/attendance). */
export class LogMyAttendanceCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly type: SelfAttendanceType,
    public readonly status: string,
    public readonly minutesLate: number | null | undefined,
    public readonly capturedAt: Date,
    public readonly location: { latitude?: number | null; longitude?: number | null; accuracy?: number | null },
    public readonly notes?: string | null,
    public readonly evidence?: AttendanceEvidenceInput | null,
  ) {}
}

export class ReviewAttendanceCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly attendanceId: string,
    public readonly decision: 'APPROVE' | 'CORRECT',
    public readonly note?: string | null,
    public readonly status?: string | null,
    public readonly minutesLate?: number | null,
  ) {}
}

export class SetBranchGeofenceCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly latitude: number,
    public readonly longitude: number,
    public readonly radiusMeters: number,
  ) {}
}

export class BranchGeofenceRefCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
  ) {}
}
