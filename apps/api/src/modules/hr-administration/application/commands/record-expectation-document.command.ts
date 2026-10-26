export class RecordExpectationDocumentCommand {
  constructor(
    public readonly employeeId: string,
    public readonly firebaseUid: string,
    public readonly fileUrl: string,
    public readonly signedAt?: Date,
    public readonly notes?: string,
  ) {}
}
