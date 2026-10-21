import type { Prisma } from '@prisma/client';

export interface HrAreaView {
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

/** Vista de administracion del catalogo: incluye el estado activo/inactivo. */
export interface HrAreaAdminView extends HrAreaView {
  isActive: boolean;
}

export interface CreateHrAreaData {
  organizationId: string;
  operatingCompanyId: string;
  code: string;
  name: string;
  description?: string | null;
  sortOrder: number;
}

export abstract class HrAreaRepositoryPort {
  /** Areas activas del catalogo de la empresa, ordenadas por `sortOrder` y nombre. */
  abstract listActive(operatingCompanyId: string, tx?: Prisma.TransactionClient): Promise<HrAreaView[]>;
  /** Todas las areas de la empresa (activas e inactivas), para quien administra el catalogo. */
  abstract listAll(operatingCompanyId: string, tx?: Prisma.TransactionClient): Promise<HrAreaAdminView[]>;
  abstract findByCode(operatingCompanyId: string, code: string, tx?: Prisma.TransactionClient): Promise<HrAreaAdminView | null>;
  abstract create(data: CreateHrAreaData, tx?: Prisma.TransactionClient): Promise<HrAreaAdminView>;
  abstract setActive(operatingCompanyId: string, code: string, isActive: boolean, tx?: Prisma.TransactionClient): Promise<HrAreaAdminView>;
  /** Cantidad de colaboradores NO terminados de la empresa asignados al area (por `areaId` = codigo). */
  abstract countActiveEmployees(operatingCompanyId: string, code: string, tx?: Prisma.TransactionClient): Promise<number>;
  /** Mayor `sortOrder` usado en la empresa (0 si no hay areas): las areas nuevas se agregan al final. */
  abstract maxSortOrder(operatingCompanyId: string, tx?: Prisma.TransactionClient): Promise<number>;
}
