export class PublishHrDocumentCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly code: string,
    public readonly title: string,
    public readonly category: string,
    public readonly fileUrl: string,
    public readonly fileHash?: string | null,
    public readonly fileName?: string | null,
    public readonly mimeType?: string,
    public readonly sizeBytes?: number | null,
  ) {}
}
