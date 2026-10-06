import type { DocumentTemplateType } from '../../domain/document-template-type';

export class GetDocumentTemplateQuery {
  constructor(
    public readonly companyId: string,
    public readonly type: DocumentTemplateType,
  ) {}
}
