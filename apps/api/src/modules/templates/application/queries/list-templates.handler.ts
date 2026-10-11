import { Injectable } from '@nestjs/common';
import { TemplateAccessService } from '../services/template-access.service';
import { TemplateRepositoryPort, TemplateRecord } from '../ports/template-repository.port';
import { ListTemplatesQuery } from './list-templates.query';

/** TDD-TPL §6.4 — Listar plantillas. Autoriza TEMPLATE.VIEW. */
@Injectable()
export class ListTemplatesHandler {
  constructor(
    private readonly access: TemplateAccessService,
    private readonly templates: TemplateRepositoryPort,
  ) {}

  async execute(query: ListTemplatesQuery): Promise<TemplateRecord[]> {
    const { context } = await this.access.authorize(query, 'VIEW');

    return this.templates.list(
      { organizationId: context.organizationId, companyId: query.companyId },
      { type: query.type, status: query.status },
    );
  }
}
