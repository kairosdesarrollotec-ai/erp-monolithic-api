import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { TemplatesController } from './presentation/http/templates.controller';
import { TemplateAccessService } from './application/services/template-access.service';
import { CreateTemplateHandler } from './application/commands/create-template.handler';
import { RequestTemplateUploadUrlHandler } from './application/commands/request-template-upload-url.handler';
import { ActivateTemplateHandler } from './application/commands/activate-template.handler';
import { ListTemplatesHandler } from './application/queries/list-templates.handler';
import { GetTemplateHandler } from './application/queries/get-template.handler';
import { TemplateRepositoryPort } from './application/ports/template-repository.port';
import { TemplateStoragePort } from './application/ports/template-storage.port';
import { PrismaTemplateRepository } from './infrastructure/persistence/prisma-template.repository';
import { GcsTemplateService } from './infrastructure/storage/gcs-template.service';

/**
 * TDD-KAIROS-MVP-002-TPL — Módulo standalone de gestión de plantillas de documentos.
 * Exporta TemplateRepositoryPort y GetTemplateHandler para uso futuro
 * de los módulos rentals y returns (TDD-TPL §9).
 */
@Module({
  imports: [UsersModule, AuthorizationModule],
  controllers: [TemplatesController],
  providers: [
    TemplateAccessService,
    CreateTemplateHandler,
    RequestTemplateUploadUrlHandler,
    ActivateTemplateHandler,
    ListTemplatesHandler,
    GetTemplateHandler,
    { provide: TemplateRepositoryPort, useClass: PrismaTemplateRepository },
    { provide: TemplateStoragePort, useClass: GcsTemplateService },
  ],
  exports: [TemplateRepositoryPort, GetTemplateHandler],
})
export class TemplatesModule {}
