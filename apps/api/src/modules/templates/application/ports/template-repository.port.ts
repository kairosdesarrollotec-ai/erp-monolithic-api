/**
 * TDD-KAIROS-MVP-002-TPL §5 — Port del repositorio de plantillas.
 * El dominio no depende de NestJS, Prisma ni HTTP.
 */

export interface TemplateRecord {
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
}

export interface CreateTemplateInput {
  organizationId: string;
  companyId: string;
  type: string;
  name: string;
  effectiveFrom?: Date;
  createdBy: string;
}

export interface TemplateScope {
  organizationId: string;
  companyId: string;
}

export interface ListTemplatesFilters {
  type?: string;
  status?: string;
}

export abstract class TemplateRepositoryPort {
  abstract create(input: CreateTemplateInput): Promise<TemplateRecord>;

  abstract findById(id: string, scope: TemplateScope): Promise<TemplateRecord | null>;

  abstract findActive(companyId: string, type: string, organizationId: string): Promise<TemplateRecord | null>;

  abstract updateStatus(
    id: string,
    status: string,
    scope: TemplateScope,
    updatedBy: string,
  ): Promise<TemplateRecord>;

  /**
   * Transacción atómica (TDD-TPL-ADR-003):
   * 1. Calcula version = max(version existente para companyId+type) + 1, o 1.
   * 2. Actualiza la plantilla `id` a ACTIVE con documentUrl, documentFormat y version.
   * 3. Retira (RETIRED) la anterior ACTIVE del mismo (companyId, type), si existe.
   */
  abstract activateWithVersion(params: {
    id: string;
    organizationId: string;
    companyId: string;
    documentUrl: string;
    documentFormat: string;
    updatedBy: string;
  }): Promise<TemplateRecord>;

  abstract list(scope: TemplateScope, filters: ListTemplatesFilters): Promise<TemplateRecord[]>;
}
