import { Injectable } from '@nestjs/common';
import { TemplateAccessService } from '../services/template-access.service';
import { TemplateRepositoryPort, TemplateRecord } from '../ports/template-repository.port';
import { CreateTemplateCommand } from './create-template.command';

/**
 * TDD-TPL §6.1 — Crear plantilla en estado DRAFT.
 * Autoriza TEMPLATE.MANAGE; persiste el registro con status DRAFT.
 */
@Injectable()
export class CreateTemplateHandler {
  constructor(
    private readonly access: TemplateAccessService,
    private readonly templates: TemplateRepositoryPort,
  ) {}

  async execute(command: CreateTemplateCommand): Promise<TemplateRecord> {
    const { context } = await this.access.authorize(command, 'MANAGE');

    return this.templates.create({
      organizationId: context.organizationId,
      companyId: command.companyId,
      type: command.type,
      name: command.name,
      effectiveFrom: command.effectiveFrom,
      createdBy: command.firebaseUid,
    });
  }
}
