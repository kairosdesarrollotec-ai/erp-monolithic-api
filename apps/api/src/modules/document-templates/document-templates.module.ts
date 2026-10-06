import { Module } from '@nestjs/common';
import { DocumentTemplateRepositoryPort } from './application/ports/document-template-repository.port';
import { GetDocumentTemplateHandler } from './application/queries/get-document-template.handler';
import { PrismaDocumentTemplateRepository } from './infrastructure/persistence/prisma-document-template.repository';

/** PROP-015b — plantillas de documentos para firma del cliente (BR-DEV-009). */
@Module({
  providers: [
    GetDocumentTemplateHandler,
    { provide: DocumentTemplateRepositoryPort, useClass: PrismaDocumentTemplateRepository },
  ],
  exports: [DocumentTemplateRepositoryPort, GetDocumentTemplateHandler],
})
export class DocumentTemplatesModule {}
