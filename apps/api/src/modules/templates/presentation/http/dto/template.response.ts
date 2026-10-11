/** TDD-TPL §6.1, §6.3, §6.5 — Respuesta de plantilla. */
export interface TemplateResponse {
  id: string;
  companyId: string;
  type: string;
  name: string;
  version: number | null;
  status: string;
  documentUrl: string | null;
  documentFormat: string | null;
  effectiveFrom: string | null;
  createdAt: string;
  createdBy: string;
}
