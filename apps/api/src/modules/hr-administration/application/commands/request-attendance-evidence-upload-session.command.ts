export class RequestAttendanceEvidenceUploadSessionCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
    public readonly contentType: string,
    public readonly contentLength: number,
  ) {}
}
