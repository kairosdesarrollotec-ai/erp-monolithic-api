import type { EmploymentTermination, Prisma, TerminationReason } from '@prisma/client';

export interface CreateTerminationData {
  employeeId: string;
  reason: TerminationReason;
  noticeDays?: number;
  finalSettlementPaid?: boolean;
  settlementAmount?: number;
  notes?: string | null;
  terminatedById: string;
  terminatedAt: Date;
}

export abstract class EmploymentTerminationRepositoryPort {
  abstract create(data: CreateTerminationData, tx?: Prisma.TransactionClient): Promise<EmploymentTermination>;
  abstract findByEmployeeId(employeeId: string, tx?: Prisma.TransactionClient): Promise<EmploymentTermination | null>;
}
