import type { EmployeeStatus, Prisma, VacationRequest, VacationStatus } from '@prisma/client';

export interface CreateVacationData {
  employeeId: string;
  /** Empresa del colaborador: el cupo de BR-ADP-002 (1 persona por area) se evalua POR EMPRESA. */
  operatingCompanyId: string;
  areaId: string;
  startDate: Date;
  endDate: Date;
  notes?: string | null;
  status?: VacationStatus;
  approvedById?: string | null;
  approvedAt?: Date | null;
}

export interface VacationWithEmployeeScope extends VacationRequest {
  employee: {
    fullName: string;
    areaName: string;
    areaId: string;
    status: EmployeeStatus;
    organizationId: string;
    operatingCompanyId: string;
    branchId: string;
  };
}

export interface VacationWithEmployee extends VacationRequest {
  employee: {
    fullName: string;
    areaName: string;
  };
}

export interface RescheduleVacationData {
  startDate: Date;
  endDate: Date;
  reason: string;
  changedById: string;
  changedAt: Date;
}

export interface CancelVacationData {
  reason: string;
  changedById: string;
  changedAt: Date;
}

export interface ResolveVacationData {
  status: VacationStatus;
  grantedDays?: number | null;
  endDate?: Date;
  statusReason?: string | null;
  approvedById?: string | null;
  approvedAt?: Date | null;
  statusChangedById?: string | null;
  statusChangedAt?: Date | null;
}

export abstract class VacationRepositoryPort {
  abstract findById(id: string, tx?: Prisma.TransactionClient): Promise<VacationWithEmployeeScope | null>;
  /** Reprograma a nuevas fechas: guarda las originales (la primera vez), cuenta el cambio y deja el estado REPROGRAMADA. */
  abstract reschedule(id: string, data: RescheduleVacationData, tx?: Prisma.TransactionClient): Promise<VacationRequest>;
  /** Cancela (estado CANCELADA, libera el cupo) con motivo y autor. */
  abstract cancel(id: string, data: CancelVacationData, tx?: Prisma.TransactionClient): Promise<VacationRequest>;
  /** Resuelve (aprueba con grantedDays, reprograma o rechaza/cancela) por Gerencia. */
  abstract resolve(id: string, data: ResolveVacationData, tx?: Prisma.TransactionClient): Promise<VacationRequest>;
  /** Vacaciones que ocupan cupo en TODA la empresa (para VACATION_CAPACITY_SCOPE = 'COMPANY'). */
  abstract findActiveByCompany(companyId: string, tx?: Prisma.TransactionClient): Promise<VacationRequest[]>;
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
