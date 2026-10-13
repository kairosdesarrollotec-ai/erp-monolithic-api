export class RequestLeaveEvidenceUploadSessionCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly leaveId: string,
    public readonly contentType: string,
    public readonly contentLength: number,
  ) {}
}
