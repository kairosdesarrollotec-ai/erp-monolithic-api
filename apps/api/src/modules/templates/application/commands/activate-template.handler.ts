import { Injectable } from '@nestjs/common';
import { TemplateAccessService } from '../services/template-access.service';
import { TemplateRepositoryPort, TemplateRecord } from '../ports/template-repository.port';
import { TemplateStoragePort } from '../ports/template-storage.port';
import {
  TemplateNotFoundError,
  TemplateDraftRequiredError,
  MissingDocumentUrlError,
} from '../../domain/template-errors';
import { ActivateTemplateCommand } from './activate-template.command';

/**
 * TDD-TPL §6.3 + TDD-TPL-ADR-003 — Activar plantilla.
 * Valida: plantilla DRAFT, objectUrl GCS válida.
 * Transacción: activa la nueva versión + retira la anterior (ACTIVE→RETIRED).
 */
@Injectable()
export class ActivateTemplateHandler {
  constructor(
    private readonly access: TemplateAccessService,
    private readonly templates: TemplateRepositoryPort,
    private readonly storage: TemplateStoragePort,
  ) {}

  async execute(command: ActivateTemplateCommand): Promise<TemplateRecord> {
    const { context } = await this.access.authorize(command, 'MANAGE');

    const template = await this.templates.findById(command.templateId, {
      organizationId: context.organizationId,
      companyId: command.companyId,
    });
    if (!template) {
      throw new TemplateNotFoundError(command.templateId);
    }
    if (template.status !== 'DRAFT') {
      throw new TemplateDraftRequiredError(command.templateId, template.status);
    }
    if (!this.storage.isValidGcsUrl(command.objectUrl)) {
      throw new MissingDocumentUrlError();
    }

    return this.templates.activateWithVersion({
      id: command.templateId,
      organizationId: context.organizationId,
      companyId: command.companyId,
      documentUrl: command.objectUrl,
      documentFormat: command.documentFormat,
      updatedBy: command.firebaseUid,
    });
  }
}
