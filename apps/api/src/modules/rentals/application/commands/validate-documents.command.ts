export interface ValidateDocumentsDetails {
  /** DNI (peruano). */
  identityDocumentValid: boolean;
  /** Pasaporte (extranjero). */
  passportValid: boolean;
  /** Carne de extranjeria, CE (extranjero). */
  foreignerCardValid: boolean;
  driverLicenseValid: boolean;
  /** Recibo de agua/luz (peruano) o constancia de hospedaje (extranjero). */
  addressOrStayProofValid: boolean;
  notes?: string;
}

export class ValidateDocumentsCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    /** Obligatorio (22-oct-2026): ya no se puede validar sin detallar los documentos. */
    public readonly documentDetails: ValidateDocumentsDetails,
  ) {}
}
