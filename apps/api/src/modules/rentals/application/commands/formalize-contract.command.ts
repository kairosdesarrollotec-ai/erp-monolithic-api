import type { ContractVariant } from '../../domain/contract-variant';

export class FormalizeContractCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly documentRef: string,
    /** Obligatorios salvo con conductor de la empresa (sin garantia, DEC-ALQ-COMPANY-DRIVER-004). */
    public readonly depositAmount: string | undefined,
    public readonly depositCurrency: string | undefined,
    public readonly signatureData?: string,
    /** BR-DOC-003: combinacion titular x conductor; si se omite se usa la plantilla generica. */
    public readonly contractVariant?: ContractVariant,
  ) {}
}
