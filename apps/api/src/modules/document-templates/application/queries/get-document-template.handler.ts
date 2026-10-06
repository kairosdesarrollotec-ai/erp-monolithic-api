import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentTemplateRepositoryPort, DocumentTemplateSnapshot } from '../ports/document-template-repository.port';
import { GetDocumentTemplateQuery } from './get-document-template.query';

@Injectable()
export class GetDocumentTemplateHandler {
  constructor(private readonly repository: DocumentTemplateRepositoryPort) {}

  async execute(query: GetDocumentTemplateQuery): Promise<DocumentTemplateSnapshot> {
    const template = await this.repository.getActive(query.companyId, query.type);
    if (!template) {
      throw new NotFoundException(`No hay plantilla activa de tipo '${query.type}' para esta empresa.`);
    }
    return template;
  }
}
