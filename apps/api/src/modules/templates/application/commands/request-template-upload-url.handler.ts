import { Injectable } from '@nestjs/common';
import { TemplateAccessService } from '../services/template-access.service';
import { TemplateRepositoryPort } from '../ports/template-repository.port';
import { TemplateStoragePort, TemplateUploadUrlResult } from '../ports/template-storage.port';
import { TemplateNotFoundError, TemplateDraftRequiredError } from '../../domain/template-errors';
import { RequestTemplateUploadUrlCommand } from './request-template-upload-url.command';

/**
 * TDD-TPL §6.2 — Solicitar URL firmada GCS para subir el documento.
 * Autoriza TEMPLATE.MANAGE; valida que la plantilla sea DRAFT y pertenezca a la empresa.
 */
@Injectable()
export class RequestTemplateUploadUrlHandler {
  constructor(
    private readonly access: TemplateAccessService,
    private readonly templates: TemplateRepositoryPort,
    private readonly storage: TemplateStoragePort,
  ) {}

  async execute(command: RequestTemplateUploadUrlCommand): Promise<TemplateUploadUrlResult> {
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

    return this.storage.generateSignedUploadUrl({
      companyId: command.companyId,
      type: template.type,
      contentType: command.contentType,
    });
  }
}
