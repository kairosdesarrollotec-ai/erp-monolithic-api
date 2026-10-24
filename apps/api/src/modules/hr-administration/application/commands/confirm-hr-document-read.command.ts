export class ConfirmHrDocumentReadCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly documentId: string,
  ) {}
}
