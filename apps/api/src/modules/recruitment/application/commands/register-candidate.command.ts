export class RegisterCandidateCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly vacancyId: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly fullName: string,
    public readonly documentType: string,
    public readonly documentNumber: string,
    public readonly cvDocumentId: string | undefined,
    public readonly email?: string | null,
    public readonly phone?: string | null,
    public readonly salaryExpectation?: number | null,
  ) {}
}
