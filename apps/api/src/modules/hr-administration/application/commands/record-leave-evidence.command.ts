export class RecordLeaveEvidenceCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly leaveId: string,
    public readonly objectUrl: string,
    public readonly contentType: string,
  ) {}
}
