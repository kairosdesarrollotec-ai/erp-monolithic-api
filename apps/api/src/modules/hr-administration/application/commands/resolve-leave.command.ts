export type LeaveResolution = 'AUTORIZADO' | 'DENEGADO';

export class ResolveLeaveCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly leaveId: string,
    public readonly status: LeaveResolution,
    public readonly resolutionNotes?: string | null,
  ) {}
}
