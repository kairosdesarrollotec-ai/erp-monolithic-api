import type { LeaveEvidence, LeaveRequest, LeaveStatus, LeaveType, Prisma } from '@prisma/client';

export interface CreateLeaveData {
  employeeId: string;
  type: LeaveType;
  date: Date;
  startTime?: Date | null;
  endTime?: Date | null;
  reason: string;
}

export interface ResolveLeaveData {
  status: LeaveStatus;
  authorizedById: string;
  authorizedByName?: string | null;
  resolutionNotes?: string | null;
  resolvedAt: Date;
}

export interface AddLeaveEvidenceData {
  leaveId: string;
  objectUrl: string;
  contentType: string;
  uploadedById: string;
}

export interface LeaveWithEmployee extends LeaveRequest {
  employee: {
    fullName: string;
    organizationId: string;
    operatingCompanyId: string;
    branchId: string;
  };
}

export abstract class LeaveRepositoryPort {
  abstract create(data: CreateLeaveData, tx?: Prisma.TransactionClient): Promise<LeaveRequest>;
  abstract findById(id: string, tx?: Prisma.TransactionClient): Promise<LeaveWithEmployee | null>;
  abstract findByEmployee(employeeId: string, limit?: number, tx?: Prisma.TransactionClient): Promise<LeaveRequest[]>;
  /** Resuelve solo si sigue SOLICITADO; si ya fue resuelta lanza LeaveAlreadyResolvedError. */
  abstract countEvidence(leaveId: string, tx?: Prisma.TransactionClient): Promise<number>;
  /** Idempotente por (leaveId, objectUrl): registrar dos veces la misma URL devuelve la evidencia ya guardada. */
  abstract addEvidence(data: AddLeaveEvidenceData, tx?: Prisma.TransactionClient): Promise<LeaveEvidence>;
  abstract listEvidence(leaveId: string, tx?: Prisma.TransactionClient): Promise<LeaveEvidence[]>;
  abstract resolve(id: string, data: ResolveLeaveData, tx?: Prisma.TransactionClient): Promise<LeaveRequest>;
}
