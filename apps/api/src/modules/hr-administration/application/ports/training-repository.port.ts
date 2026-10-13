import type { Prisma, TrainingSession } from '@prisma/client';

export interface CreateTrainingData {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  topic: string;
  heldOn: Date;
  durationMinutes: number;
  comprehensionNotes?: string | null;
  createdById: string;
  attendeeIds: string[];
}

export interface TrainingWithAttendees extends TrainingSession {
  attendees: Array<{ employeeId: string; employee: { fullName: string } }>;
}

export abstract class TrainingRepositoryPort {
  abstract create(data: CreateTrainingData, tx?: Prisma.TransactionClient): Promise<TrainingWithAttendees>;
  abstract findMany(
    filters: { companyId: string; branchId?: string; limit?: number },
    tx?: Prisma.TransactionClient,
  ): Promise<TrainingWithAttendees[]>;
  /** Historial de capacitación del colaborador (DAT-ADP-009): talleres a los que asistió. */
  abstract findByEmployee(employeeId: string, limit?: number, tx?: Prisma.TransactionClient): Promise<TrainingWithAttendees[]>;
}
