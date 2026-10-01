import { ContractTemplateRecord } from '../../application/ports/rental-repository.port';
import { ContractTemplateResponse } from './dto/contract-template.response';

export function toContractTemplateResponse(record: ContractTemplateRecord): ContractTemplateResponse {
  return {
    id: record.id,
    companyId: record.companyId,
    type: record.type,
    version: record.version,
    effectiveFrom: record.effectiveFrom.toISOString(),
    effectiveTo: record.effectiveTo ? record.effectiveTo.toISOString() : null,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
  };
}
