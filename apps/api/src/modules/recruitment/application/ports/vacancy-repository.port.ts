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
  abstract list(
    filter: ListVacanciesFilter,
    scope: { organizationId: string; operatingCompanyId: string },
  ): Promise<VacancyRecord[]>;
  abstract generateNextCode(operatingCompanyId: string, tx?: Prisma.TransactionClient): Promise<string>;
}
