import type { ContractVariant } from '../../domain/contract-variant';

/** Decision 8 (22-oct-2026, ALQ P-01 / BR-ALQ-011): comprobante del cobro de la garantia. */
export interface GuaranteePaymentCommandInput {
  method: string;
  /** Nº de operacion; en EFECTIVO, nº de recibo. */
  operationNumber?: string;
  payerName: string;
  /** Obligatorio si paga un agente externo. */
  payerDocumentNumber?: string;
  payerIsExternalAgent: boolean;
  /** BR-ALQ-011: confirmacion de la verificacion adicional del agente externo (debe ser true si paga un agente). */
  externalAgentVerified: boolean;
  /** Id del RentalDocument PAYMENT_VOUCHER ya subido al alquiler. */
  voucherDocumentId?: string;
}

export class FormalizeContractCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly documentRef: string,
    /**
     * Opcional (22-oct-2026): si se omite y Flota define la garantia del vehiculo, el servidor usa la exigida
     * (tarifa de Flota, x2 si DOUBLE_DEPOSIT). Si se envia, no puede ser menor a la exigida. Sin conductor de la empresa
     * y sin garantia definida en Flota es obligatoria. Con conductor de la empresa no se exige ni cobra (DEC-ALQ-COMPANY-DRIVER-004).
     */
    public readonly depositAmount: string | undefined,
    public readonly depositCurrency: string | undefined,
    public readonly signatureData?: string,
    /** BR-DOC-003: combinacion titular x conductor; si se omite se usa la plantilla generica. */
    public readonly contractVariant?: ContractVariant,
    /** Comprobante del cobro de la garantia (obligatorio si la diferencia a cobrar es mayor que cero). */
    public readonly payment?: GuaranteePaymentCommandInput,
    /** C5: Huella física tomada en el contrato en papel (no biometría). */
    public readonly fingerprintTaken: boolean = false,
  ) {}
}
