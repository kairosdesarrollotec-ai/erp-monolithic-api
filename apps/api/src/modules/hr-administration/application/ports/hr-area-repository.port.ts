import type { Prisma } from '@prisma/client';

export interface HrAreaView {
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export abstract class HrAreaRepositoryPort {
  /** Areas activas del catalogo de la empresa, ordenadas por `sortOrder` y nombre. */
  abstract listActive(operatingCompanyId: string, tx?: Prisma.TransactionClient): Promise<HrAreaView[]>;
}
