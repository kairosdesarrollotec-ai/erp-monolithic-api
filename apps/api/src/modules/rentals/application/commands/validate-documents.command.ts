export class ValidateDocumentsCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly documentDetails?: {
      identityDocumentValid: boolean;
      driverLicenseValid: boolean;
      addressOrStayProofValid: boolean;
      notes?: string;
    },
  ) {}
}
