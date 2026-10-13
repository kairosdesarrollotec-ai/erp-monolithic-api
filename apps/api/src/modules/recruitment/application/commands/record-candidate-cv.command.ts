export class RecordCandidateCvCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly candidateId: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly objectUrl: string,
    public readonly fileName: string,
    public readonly expectedVersion: number,
  ) {}
}
