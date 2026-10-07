export class GetCandidateDetailQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly id: string,
    public readonly companyId: string,
    public readonly branchId: string,
  ) {}
}
