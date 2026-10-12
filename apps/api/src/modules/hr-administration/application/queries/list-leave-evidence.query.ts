export class ListLeaveEvidenceQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly leaveId: string,
  ) {}
}
