import { Injectable } from '@nestjs/common';
import type { Prisma, Vacancy } from '@prisma/client';
import { CandidateStage, VacancyStatus } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreateVacancyInput,
  ListVacanciesFilter,
  PublishVacancyInput,
  VacancyDetailRecord,
  VacancyRecord,
  VacancyRepositoryPort,
} from '../../application/ports/vacancy-repository.port';
import { VacancyVersionConflictError } from '../../domain/recruitment-errors';

@Injectable()
export class PrismaVacancyRepository implements VacancyRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private mapToRecord(entity: Vacancy): VacancyRecord {
    return {
      id: entity.id,
      organizationId: entity.organizationId,
      operatingCompanyId: entity.operatingCompanyId,
      branchId: entity.branchId,
      code: entity.code,
      title: entity.title,
      department: entity.department,
      source: entity.source,
      status: entity.status,
      isMechanic: entity.isMechanic,
      profileDescription: entity.profileDescription,
      baseSalary: entity.baseSalary ? Number(entity.baseSalary) : null,
      scheduleDetails: entity.scheduleDetails,
      publishedChannels: entity.publishedChannels,
      version: entity.version,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdBy: entity.createdBy,
    };
  }

  async create(input: CreateVacancyInput, tx?: Prisma.TransactionClient): Promise<VacancyRecord> {
    const client = tx ?? this.prisma;
    const created = await client.vacancy.create({
      data: {
        organizationId: input.organizationId,
        operatingCompanyId: input.operatingCompanyId,
        branchId: input.branchId,
        code: input.code,
        title: input.title,
        department: input.department,
        source: input.source,
        status: VacancyStatus.NECESIDAD_REGISTRADA,
        isMechanic: input.isMechanic,
        createdBy: input.createdBy,
      },
    });
    return this.mapToRecord(created);
  }

  async findById(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string; branchId: string },
    tx?: Prisma.TransactionClient,
  ): Promise<VacancyRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.vacancy.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
        branchId: scope.branchId,
      },
    });
    return found ? this.mapToRecord(found) : null;
  }

  async findDetailById(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string; branchId: string },
    tx?: Prisma.TransactionClient,
  ): Promise<VacancyDetailRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.vacancy.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
        branchId: scope.branchId,
      },
      include: {
        candidates: {
          select: { stage: true },
        },
      },
    });
    if (!found) {
      return null;
    }

    const counts: Record<CandidateStage, number> = {
      NUEVO: 0,
      CONTACTADO: 0,
      ENTREVISTA: 0,
      DECISION: 0,
    };

    for (const c of found.candidates) {
      counts[c.stage] = (counts[c.stage] || 0) + 1;
    }

    return {
      ...this.mapToRecord(found),
      candidatesCount: found.candidates.length,
      candidatesByStage: counts,
    };
  }

  async publish(
    id: string,
    input: PublishVacancyInput,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<VacancyRecord> {
    const client = tx ?? this.prisma;
    const updated = await client.vacancy.updateMany({
      where: {
        id,
        version: expectedVersion,
      },
      data: {
        status: VacancyStatus.PUBLICADA,
        profileDescription: input.profileDescription,
        baseSalary: input.baseSalary,
        scheduleDetails: input.scheduleDetails,
        publishedChannels: input.publishedChannels,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new VacancyVersionConflictError();
    }

    const reloaded = await client.vacancy.findUniqueOrThrow({ where: { id } });
    return this.mapToRecord(reloaded);
  }

  async updateStatus(
    id: string,
    status: VacancyStatus,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<VacancyRecord> {
    const client = tx ?? this.prisma;
    const updated = await client.vacancy.updateMany({
      where: {
        id,
        version: expectedVersion,
      },
      data: {
        status,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new VacancyVersionConflictError();
    }

    const reloaded = await client.vacancy.findUniqueOrThrow({ where: { id } });
    return this.mapToRecord(reloaded);
  }

  async list(
    filter: ListVacanciesFilter,
    scope: { organizationId: string; operatingCompanyId: string },
  ): Promise<VacancyRecord[]> {
    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const where: Prisma.VacancyWhereInput = {
      organizationId: scope.organizationId,
      operatingCompanyId: scope.operatingCompanyId,
      ...(filter.branchId ? { branchId: filter.branchId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    };

    if (filter.cursorCreatedAt && filter.cursorId) {
      where.OR = [
        { createdAt: { lt: filter.cursorCreatedAt } },
        {
          createdAt: filter.cursorCreatedAt,
          id: { lt: filter.cursorId },
        },
      ];
    }

    const items = await this.prisma.vacancy.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    return items.map((item) => this.mapToRecord(item));
  }

  async generateNextCode(operatingCompanyId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx ?? this.prisma;
    const year = new Date().getFullYear();
    const prefix = `VAC-${year}-`;
    const count = await client.vacancy.count({
      where: {
        operatingCompanyId,
        code: { startsWith: prefix },
      },
    });
    const sequence = (count + 1).toString().padStart(4, '0');
    return `${prefix}${sequence}`;
  }
}
