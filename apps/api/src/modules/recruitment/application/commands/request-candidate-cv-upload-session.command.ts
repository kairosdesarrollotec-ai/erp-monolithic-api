export class RequestCandidateCvUploadSessionCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly candidateId: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly contentType: string,
    public readonly contentLength: number,
  ) {}
}
