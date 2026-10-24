import { Injectable } from '@nestjs/common';
import { HrDocumentRead, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  HrDocumentRepositoryPort,
  HrDocumentWithCurrentVersion,
  PublishDocumentData,
} from '../../application/ports/hr-document-repository.port';

@Injectable()
export class PrismaHrDocumentRepository implements HrDocumentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async publishVersion(data: PublishDocumentData, tx?: Prisma.TransactionClient): Promise<HrDocumentWithCurrentVersion> {
    const client = tx ?? this.prisma;

    let doc = await client.hrDocument.findFirst({
      where: {
        operatingCompanyId: data.operatingCompanyId,
        code: data.code,
      },
    });

    if (!doc) {
      doc = await client.hrDocument.create({
        data: {
          organizationId: data.organizationId,
          operatingCompanyId: data.operatingCompanyId,
          code: data.code,
          title: data.title,
          category: data.category,
        },
      });
    } else {
      // Si el título o categoría cambian, actualizamos la ficha cabecera
      doc = await client.hrDocument.update({
        where: { id: doc.id },
        data: {
          title: data.title,
          category: data.category,
        },
      });
    }

    // Buscar la versión más alta existente para este documento
    const lastVersion = await client.hrDocumentVersion.findFirst({
      where: { documentId: doc.id },
      orderBy: { version: 'desc' },
    });

    const nextVersion = lastVersion ? lastVersion.version + 1 : 1;

    // Desactivar la versión vigente anterior (append-only: nunca se borra)
    await client.hrDocumentVersion.updateMany({
      where: {
        documentId: doc.id,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });

    // Insertar la nueva versión como vigente única
    const newVersion = await client.hrDocumentVersion.create({
      data: {
        organizationId: data.organizationId,
        operatingCompanyId: data.operatingCompanyId,
        documentId: doc.id,
        version: nextVersion,
        fileUrl: data.fileUrl,
        fileHash: data.fileHash ?? null,
        fileName: data.fileName ?? null,
        mimeType: data.mimeType ?? 'application/pdf',
        sizeBytes: data.sizeBytes ?? null,
        isCurrent: true,
        publishedBy: data.publishedBy,
      },
    });

    return {
      ...doc,
      currentVersion: newVersion,
    };
  }

  async findByCode(companyId: string, code: string, tx?: Prisma.TransactionClient): Promise<HrDocumentWithCurrentVersion | null> {
    const client = tx ?? this.prisma;
    const doc = await client.hrDocument.findFirst({
      where: { operatingCompanyId: companyId, code },
      include: {
        versions: {
          where: { isCurrent: true },
        },
      },
    });

    if (!doc || doc.versions.length === 0) return null;

    const { versions, ...rest } = doc;
    return {
      ...rest,
      currentVersion: versions[0],
    };
  }

  async findActiveById(id: string, companyId: string, tx?: Prisma.TransactionClient): Promise<HrDocumentWithCurrentVersion | null> {
    const client = tx ?? this.prisma;

    // 1. Intentar por document_id
    const doc = await client.hrDocument.findFirst({
      where: { id, operatingCompanyId: companyId },
      include: {
        versions: {
          where: { isCurrent: true },
        },
      },
    });

    if (doc && doc.versions.length > 0) {
      const { versions, ...rest } = doc;
      return {
        ...rest,
        currentVersion: versions[0],
      };
    }

    // 2. Intentar por version_id
    const ver = await client.hrDocumentVersion.findFirst({
      where: { id, operatingCompanyId: companyId, isCurrent: true },
      include: { document: true },
    });

    if (ver && ver.document) {
      const { document, ...verRest } = ver;
      return {
        ...document,
        currentVersion: verRest,
      };
    }

    return null;
  }

  async listActive(companyId: string, category?: string): Promise<HrDocumentWithCurrentVersion[]> {
    const docs = await this.prisma.hrDocument.findMany({
      where: {
        operatingCompanyId: companyId,
        ...(category ? { category } : {}),
        versions: {
          some: { isCurrent: true },
        },
      },
      include: {
        versions: {
          where: { isCurrent: true },
        },
      },
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });

    return docs
      .filter((d) => d.versions.length > 0)
      .map((d) => {
        const { versions, ...rest } = d;
        return {
          ...rest,
          currentVersion: versions[0],
        };
      });
  }

  async recordRead(
    input: {
      documentVersionId: string;
      employeeId: string;
      companyId: string;
      organizationId: string;
      readByUid: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<HrDocumentRead> {
    const client = tx ?? this.prisma;
    return client.hrDocumentRead.upsert({
      where: {
        documentVersionId_employeeId: {
          documentVersionId: input.documentVersionId,
          employeeId: input.employeeId,
        },
      },
      create: {
        organizationId: input.organizationId,
        operatingCompanyId: input.companyId,
        documentVersionId: input.documentVersionId,
        employeeId: input.employeeId,
        readByUid: input.readByUid,
      },
      update: {
        readAt: new Date(),
        readByUid: input.readByUid,
      },
    });
  }

  async findReadsByEmployee(employeeId: string): Promise<HrDocumentRead[]> {
    return this.prisma.hrDocumentRead.findMany({
      where: { employeeId },
    });
  }
}
