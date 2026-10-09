import { Injectable } from '@nestjs/common';
import { TemplateAccessService } from '../services/template-access.service';
import { TemplateRepositoryPort, TemplateRecord } from '../ports/template-repository.port';
import { TemplateNotFoundError } from '../../domain/template-errors';
import { GetTemplateQuery } from './get-template.query';

/** TDD-TPL §6.5 — Obtener plantilla por ID. Autoriza TEMPLATE.VIEW. */
@Injectable()
export class GetTemplateHandler {
  constructor(
    private readonly access: TemplateAccessService,
    private readonly templates: TemplateRepositoryPort,
  ) {}

  async execute(query: GetTemplateQuery): Promise<TemplateRecord> {
    const { context } = await this.access.authorize(query, 'VIEW');

    const template = await this.templates.findById(query.id, {
      organizationId: context.organizationId,
      companyId: query.companyId,
    });
    if (!template) {
      throw new TemplateNotFoundError(query.id);
    }
    return template;
  }
}
