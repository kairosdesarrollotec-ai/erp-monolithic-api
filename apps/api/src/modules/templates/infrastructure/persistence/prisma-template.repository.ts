import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreateTemplateInput,
  TemplateRecord,
  TemplateRepositoryPort,
  TemplateScope,
  ListTemplatesFilters,
} from '../../application/ports/template-repository.port';

function toRecord(row: {
  id: string;
  organizationId: string;
  companyId: string;
  type: string;
  name: string;
  version: number | null;
  status: string;
  documentUrl: string | null;
  documentFormat: string | null;
  effectiveFrom: Date | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}): TemplateRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    companyId: row.companyId,
    type: row.type,
    name: row.name,
    version: row.version,
    status: row.status,
    documentUrl: row.documentUrl,
    documentFormat: row.documentFormat,
    effectiveFrom: row.effectiveFrom,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

/**
 * TDD-TPL §5 + §8 — Implementación Prisma del repositorio de plantillas.
 * Todas las operaciones filtran por organizationId + companyId (multitenancy).
 */
@Injectable()
export class PrismaTemplateRepository implements TemplateRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateTemplateInput): Promise<TemplateRecord> {
    const row = await this.prisma.template.create({
      data: {
        organizationId: input.organizationId,
        companyId: input.companyId,
        type: input.type,
        name: input.name,
        status: 'DRAFT',
        effectiveFrom: input.effectiveFrom ?? null,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      },
    });
    return toRecord(row);
  }

  async findById(id: string, scope: TemplateScope): Promise<TemplateRecord | null> {
    const row = await this.prisma.template.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        companyId: scope.companyId,
      },
    });
    return row ? toRecord(row) : null;
  }

  async findActive(companyId: string, type: string, organizationId: string): Promise<TemplateRecord | null> {
    const row = await this.prisma.template.findFirst({
      where: {
        companyId,
        type,
        organizationId,
        status: 'ACTIVE',
      },
    });
    return row ? toRecord(row) : null;
  }

  /**
   * TDD-TPL-ADR-003 — Transacción atómica:
   * 1. Calcula version = max existente para (companyId, type) + 1.
   * 2. Activa la plantilla con documentUrl, documentFormat y version.
   * 3. Retira (RETIRED) la anterior ACTIVE del mismo (companyId, type).
   */
  async activateWithVersion(params: {
    id: string;
    organizationId: string;
    companyId: string;
    documentUrl: string;
    documentFormat: string;
    updatedBy: string;
  }): Promise<TemplateRecord> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Calcular la versión máxima existente para este (companyId, type)
      const templateToActivate = await tx.template.findFirstOrThrow({
        where: {
          id: params.id,
          organizationId: params.organizationId,
          companyId: params.companyId,
        },
      });

      const aggregate = await tx.template.aggregate({
        where: {
          companyId: params.companyId,
          type: templateToActivate.type,
          organizationId: params.organizationId,
          NOT: { version: null },
        },
        _max: { version: true },
      });
      const nextVersion = (aggregate._max.version ?? 0) + 1;

      // 2. Retirar la versión ACTIVE anterior si existe
      await tx.template.updateMany({
        where: {
          companyId: params.companyId,
          type: templateToActivate.type,
          organizationId: params.organizationId,
          status: 'ACTIVE',
          NOT: { id: params.id },
        },
        data: {
          status: 'RETIRED',
          updatedBy: params.updatedBy,
        },
      });

      // 3. Activar la nueva plantilla
      const activated = await tx.template.update({
        where: { id: params.id },
        data: {
          status: 'ACTIVE',
          version: nextVersion,
          documentUrl: params.documentUrl,
          documentFormat: params.documentFormat,
          updatedBy: params.updatedBy,
        },
      });

      return toRecord(activated);
    });
  }

  async list(scope: TemplateScope, filters: ListTemplatesFilters): Promise<TemplateRecord[]> {
    const rows = await this.prisma.template.findMany({
      where: {
        organizationId: scope.organizationId,
        companyId: scope.companyId,
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map(toRecord);
  }
}
