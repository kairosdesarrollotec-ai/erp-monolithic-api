import type { Prisma, VacancySource, VacancyStatus, CandidateStage } from '@prisma/client';

export interface VacancyRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  code: string;
  title: string;
  department: string;
  source: VacancySource;
  status: VacancyStatus;
  isMechanic: boolean;
  profileDescription: string | null;
  baseSalary: number | null;
  scheduleDetails: string | null;
  publishedChannels: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  /** 22-oct (#5): terminacion / colaborador que origino la vacante (null si se registro a mano). */
  originTerminationId: string | null;
  originEmployeeId: string | null;
  originCandidateId: string | null;
  /** REC-02 cancelar: motivo, fecha y autor (null mientras no este cancelada). */
  cancelReason: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
}

export interface VacancyDetailRecord extends VacancyRecord {
  candidatesCount: number;
  candidatesByStage: Record<CandidateStage, number>;
}

export interface CreateVacancyInput {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  code: string;
  title: string;
  department: string;
  source: VacancySource;
  isMechanic: boolean;
  createdBy: string;
  /** Vacante creada por un evento (RelacionLaboralTerminada.v1): id del evento outbox (UNIQUE => idempotente) y origen. */
  originEventId?: string | null;
  originTerminationId?: string | null;
  originEmployeeId?: string | null;
  originCandidateId?: string | null;
}

export interface PublishVacancyInput {
  profileDescription: string;
  baseSalary: number;
  scheduleDetails: string;
  publishedChannels: string[];
}

export interface ListVacanciesFilter {
  operatingCompanyId: string;
  branchId?: string;
  status?: VacancyStatus;
  limit?: number;
  cursorCreatedAt?: Date;
  cursorId?: string;
}

export abstract class VacancyRepositoryPort {
  abstract create(input: CreateVacancyInput, tx?: Prisma.TransactionClient): Promise<VacancyRecord>;
  abstract findById(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string; branchId: string },
    tx?: Prisma.TransactionClient,
  ): Promise<VacancyRecord | null>;
  abstract findDetailById(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string; branchId: string },
    tx?: Prisma.TransactionClient,
  ): Promise<VacancyDetailRecord | null>;
  abstract publish(
    id: string,
    input: PublishVacancyInput,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<VacancyRecord>;
  abstract updateStatus(
    id: string,
    status: VacancyStatus,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<VacancyRecord>;
  /** REC-02 cancelar: pasa a CANCELADA con motivo/autor/fecha, con control de version optimista. */
  abstract cancel(
    id: string,
    input: { reason: string; cancelledBy: string; cancelledAt: Date },
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<VacancyRecord>;
  /** Vacante creada por el evento outbox dado (idempotencia del consumidor de RelacionLaboralTerminada.v1). */
  abstract findByOriginEventId(originEventId: string, tx?: Prisma.TransactionClient): Promise<VacancyRecord | null>;
  /** Vacante de reemplazo ya originada por la salida de este candidato (evita duplicar prueba negativa + baja de ficha). */
  abstract findByOriginCandidateId(originCandidateId: string, tx?: Prisma.TransactionClient): Promise<VacancyRecord | null>;
  abstract list(
    filter: ListVacanciesFilter,
    scope: { organizationId: string; operatingCompanyId: string },
  ): Promise<VacancyRecord[]>;
  abstract generateNextCode(operatingCompanyId: string, tx?: Prisma.TransactionClient): Promise<string>;
}
