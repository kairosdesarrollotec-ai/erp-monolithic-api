import { TemplateRecord } from '../../application/ports/template-repository.port';
import { TemplateResponse } from './dto/template.response';

/** TDD-TPL §6 — Convierte un TemplateRecord al DTO de respuesta HTTP. */
export function toTemplateResponse(record: TemplateRecord): TemplateResponse {
  return {
    id: record.id,
    companyId: record.companyId,
    type: record.type,
    name: record.name,
    version: record.version,
    status: record.status,
    documentUrl: record.documentUrl,
    documentFormat: record.documentFormat,
    effectiveFrom: record.effectiveFrom ? record.effectiveFrom.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
  };
}
