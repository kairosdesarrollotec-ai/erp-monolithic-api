import type { HolderType } from '../../domain/contract-variant';

export class RegisterCompanionCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    /** Cliente (persona) con licencia vigente que firma como responsable; debe existir en la empresa. */
    public readonly companionCustomerId: string,
    /** Conductor real (parte DRIVER); obligatorio con acompanante firmante. Debe existir en la empresa. */
    public readonly driverCustomerId: string,
    /** Check de checklist: licencia vigente del acompanante verificada (la licencia NO se guarda). */
    public readonly companionLicenseVerified: boolean,
    /** Check de checklist: licencia vigente del conductor real verificada (la licencia NO se guarda). */
    public readonly driverLicenseVerified: boolean,
    /** Motivo por el que el titular no puede firmar (obligatorio; queda en auditoria y en el evento). */
    public readonly reason: string,
    /** Referencia documental opcional: la autorizacion del acompanante es la del firmante, no se exige documento aparte. */
    public readonly addendumDocumentRef?: string,
    /** Solo necesario si el alquiler aun no tiene contrato formalizado con tipo de titular. */
    public readonly holderType?: HolderType,
  ) {}
}
