import type { DocumentTemplateType } from '../../domain/document-template-type';

export interface DocumentTemplateSnapshot {
  id: string;
  companyId: string;
  type: DocumentTemplateType;
  name: string;
  content: string;
  version: number;
}

export abstract class DocumentTemplateRepositoryPort {
  /** Plantilla activa para una empresa y tipo. Null si no está configurada. */
  abstract getActive(companyId: string, type: DocumentTemplateType): Promise<DocumentTemplateSnapshot | null>;
}
