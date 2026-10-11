import type { Prisma, VacationRequest, VacationStatus } from '@prisma/client';

export interface CreateVacationData {
  employeeId: string;
  areaId: string;
  startDate: Date;
  endDate: Date;
  notes?: string | null;
  status?: VacationStatus;
  approvedById?: string | null;
  approvedAt?: Date | null;
}

export interface VacationWithEmployee extends VacationRequest {
  employee: {
    fullName: string;
    areaName: string;
  };
}

export abstract class VacationRepositoryPort {
  abstract create(data: CreateVacationData, tx?: Prisma.TransactionClient): Promise<VacationRequest>;
  abstract findByEmployee(employeeId: string, limit?: number, tx?: Prisma.TransactionClient): Promise<VacationRequest[]>;
  /** Vacaciones que ocupan cupo en el área de la empresa (SOLICITADA/PROGRAMADA/REPROGRAMADA), por orden de solicitud. */
  abstract findActiveByArea(
    companyId: string,
    areaId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<VacationRequest[]>;
  abstract findCalendar(
    companyId: string,
    year: number,
    month?: number,
    areaId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<VacationWithEmployee[]>;
}
