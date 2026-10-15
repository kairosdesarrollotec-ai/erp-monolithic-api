import type { HolderType } from '../../domain/contract-variant';

export class RegisterAuthorizedDriverCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    /** Cliente (persona) que conducira; debe existir en la empresa. */
    public readonly driverCustomerId: string,
    /** Referencia de la adenda firmada por el conductor autorizado (obligatoria). */
    public readonly addendumDocumentRef: string,
    /** Solo necesario si el alquiler aun no tiene contrato formalizado con tipo de titular. */
    public readonly holderType?: HolderType,
  ) {}
}
