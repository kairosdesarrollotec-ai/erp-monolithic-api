export interface ContractTemplateResponse {
  id: string;
  companyId: string;
  type: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  createdAt: string;
}
