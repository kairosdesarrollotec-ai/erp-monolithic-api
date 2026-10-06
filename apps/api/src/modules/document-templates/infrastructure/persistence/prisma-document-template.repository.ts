import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { DocumentTemplateRepositoryPort, DocumentTemplateSnapshot } from '../../application/ports/document-template-repository.port';
import type { DocumentTemplateType } from '../../domain/document-template-type';

@Injectable()
export class PrismaDocumentTemplateRepository implements DocumentTemplateRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getActive(companyId: string, type: DocumentTemplateType): Promise<DocumentTemplateSnapshot | null> {
    const row = await this.prisma.documentTemplate.findFirst({
      where: { companyId, type, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!row) return null;
    return {
      id: row.id,
      companyId: row.companyId,
      type: row.type as DocumentTemplateType,
      name: row.name,
      content: row.content,
      version: row.version,
    };
  }
}
