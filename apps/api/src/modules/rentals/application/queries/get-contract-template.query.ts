import type { ContractVariant } from '../../domain/contract-variant';

export class GetContractTemplateQuery {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly variant?: ContractVariant,
  ) {}
}
