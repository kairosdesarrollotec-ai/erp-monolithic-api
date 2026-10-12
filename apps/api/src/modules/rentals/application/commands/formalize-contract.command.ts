import type { ContractVariant } from '../../domain/contract-variant';

export class FormalizeContractCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly documentRef: string,
    public readonly depositAmount: string,
    public readonly depositCurrency: string,
    public readonly signatureData?: string,
    /** BR-DOC-003: combinacion titular x conductor; si se omite se usa la plantilla generica. */
    public readonly contractVariant?: ContractVariant,
  ) {}
}
