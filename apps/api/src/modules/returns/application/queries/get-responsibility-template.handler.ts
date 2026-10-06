import { Injectable } from '@nestjs/common';
import { GetDocumentTemplateHandler } from '../../../document-templates/application/queries/get-document-template.handler';
import { GetDocumentTemplateQuery } from '../../../document-templates/application/queries/get-document-template.query';
import { DocumentTemplateSnapshot } from '../../../document-templates/application/ports/document-template-repository.port';
import { DocumentTemplateType } from '../../../document-templates/domain/document-template-type';
import { ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnNotFoundError } from '../../domain/return-errors';
import { GetResponsibilityTemplateQuery } from './get-responsibility-template.query';

/**
 * PROP-015b — obtiene la plantilla activa de documento de responsabilidad
 * para el contexto de una devolución específica (BR-DEV-009).
 */
@Injectable()
export class GetResponsibilityTemplateHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly getDocumentTemplate: GetDocumentTemplateHandler,
  ) {}

  async execute(query: GetResponsibilityTemplateQuery): Promise<DocumentTemplateSnapshot> {
    const { scope } = await this.access.authorize(query, 'READ');

    const returnRecord = await this.returns.findById(query.returnId, scope);
    if (!returnRecord) {
      throw new ReturnNotFoundError(query.returnId);
    }

    return this.getDocumentTemplate.execute(
      new GetDocumentTemplateQuery(returnRecord.operatingCompanyId, DocumentTemplateType.RETURN_RESPONSIBILITY),
    );
  }
}
