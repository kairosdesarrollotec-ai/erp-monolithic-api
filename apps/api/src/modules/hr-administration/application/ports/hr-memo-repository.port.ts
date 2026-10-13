import type { HrMemo, Prisma } from '@prisma/client';

export interface CreateHrMemoData {
  organizationId: string;
  employeeId: string;
  kind: string;
  sourceType: string;
  sourceId: string;
  violationNumber: number;
  reason: string;
  issuedOn: Date;
}

export abstract class HrMemoRepositoryPort {
  /**
   * Crea el memo si todavía no existe uno para la misma causa (`sourceType + sourceId`): reintentos y reclasificaciones
   * repetidas no duplican el memorando. `created` indica si esta llamada lo generó.
   */
  abstract createIfAbsent(
    data: CreateHrMemoData,
    tx?: Prisma.TransactionClient,
  ): Promise<{ memo: HrMemo; created: boolean }>;
  abstract findByEmployee(employeeId: string, limit?: number, tx?: Prisma.TransactionClient): Promise<HrMemo[]>;
}
