import type { DocumentTemplateSnapshot } from '../../../../document-templates/application/ports/document-template-repository.port';

export interface ResponsibilityTemplateResponse {
  type: string;
  name: string;
  content: string;
  version: number;
}

export function toResponsibilityTemplateResponse(snapshot: DocumentTemplateSnapshot): ResponsibilityTemplateResponse {
  return {
    type: snapshot.type,
    name: snapshot.name,
    content: snapshot.content,
    version: snapshot.version,
  };
}
