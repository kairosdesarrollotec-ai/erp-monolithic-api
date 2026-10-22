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
  /**
   * 22-oct (#5): id de la vacante que Reclutamiento creo a partir de esta terminacion (consumiendo RelacionLaboralTerminada.v1), o
   * null si aun no se creo (el consumo es asincrono). Si la ficha viene de un candidato, tambien cuenta la vacante originada
   * por su prueba negativa (un candidato origina una sola vacante de reemplazo).
   */
  abstract findCreatedVacancyId(terminationId: string, candidateId?: string | null, tx?: Prisma.TransactionClient): Promise<string | null>;
}
