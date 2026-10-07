import { Injectable } from '@nestjs/common';
import type { Prisma, Candidate } from '@prisma/client';
import { CandidateDecision, CandidateStage } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CandidateDetailRecord,
  CandidateRecord,
  CandidateRepositoryPort,
  CreateCandidateInput,
} from '../../application/ports/candidate-repository.port';
import { CandidateVersionConflictError } from '../../domain/recruitment-errors';

@Injectable()
export class PrismaCandidateRepository implements CandidateRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private mapToRecord(entity: Candidate): CandidateRecord {
    return {
      id: entity.id,
      vacancyId: entity.vacancyId,
      fullName: entity.fullName,
      documentType: entity.documentType,
      documentNumber: entity.documentNumber,
      email: entity.email,
      phone: entity.phone,
      cvDocumentId: entity.cvDocumentId,
      salaryExpectation: entity.salaryExpectation ? Number(entity.salaryExpectation) : null,
      stage: entity.stage,
      score: entity.score ? Number(entity.score) : null,
      decision: entity.decision,
      decisionNotes: entity.decisionNotes,
      decidedBy: entity.decidedBy,
      decidedAt: entity.decidedAt,
      version: entity.version,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  async create(input: CreateCandidateInput, tx?: Prisma.TransactionClient): Promise<CandidateRecord> {
    const client = tx ?? this.prisma;
    const vacancy = await client.vacancy.findUniqueOrThrow({
      where: { id: input.vacancyId },
      select: { organizationId: true, operatingCompanyId: true },
    });

    const created = await client.candidate.create({
      data: {
        organizationId: vacancy.organizationId,
        operatingCompanyId: vacancy.operatingCompanyId,
        vacancyId: input.vacancyId,
        fullName: input.fullName,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        email: input.email ?? null,
        phone: input.phone ?? null,
        cvDocumentId: input.cvDocumentId,
        salaryExpectation: input.salaryExpectation ?? null,
        stage: CandidateStage.NUEVO,
      },
    });

    return this.mapToRecord(created);
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<CandidateRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.candidate.findUnique({
      where: { id },
    });
    return found ? this.mapToRecord(found) : null;
  }

  async findDetailById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateDetailRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.candidate.findUnique({
      where: { id },
      include: {
        interviews: {
          orderBy: { scheduledAt: 'desc' },
        },
        onboarding: true,
        vacancy: { select: { isMechanic: true } },
      },
    });
    if (!found) {
      return null;
    }

    return {
      ...this.mapToRecord(found),
      isMechanic: found.vacancy.isMechanic,
      interviews: found.interviews.map((i) => ({
        id: i.id,
        candidateId: i.candidateId,
        scheduledAt: i.scheduledAt,
        isVirtual: i.isVirtual,
        meetUrl: i.meetUrl,
        location: i.location,
        interviewerId: i.interviewerId,
        qualitativeNotes: i.qualitativeNotes,
        result: i.result,
        evaluatedAt: i.evaluatedAt,
        createdAt: i.createdAt,
      })),
      onboarding: found.onboarding
        ? {
            id: found.onboarding.id,
            candidateId: found.onboarding.candidateId,
            startDate: found.onboarding.startDate,
            inductionScheduled: found.onboarding.inductionScheduled,
            equipmentAssigned: found.onboarding.equipmentAssigned,
            responsibilityCardSigned: found.onboarding.responsibilityCardSigned,
            notarizedContractSigned: found.onboarding.notarizedContractSigned,
            isCompleted: found.onboarding.isCompleted,
            completedAt: found.onboarding.completedAt,
            probationPassed: found.onboarding.probationPassed,
            probationEvaluation: found.onboarding.probationEvaluation,
            probationEvaluatedAt: found.onboarding.probationEvaluatedAt,
            probationEvaluatedBy: found.onboarding.probationEvaluatedBy,
            completedBy: found.onboarding.completedBy,
            createdAt: found.onboarding.createdAt,
          }
        : null,
    };
  }

  async findByDocumentNumber(
    vacancyId: string,
    documentNumber: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.candidate.findFirst({
      where: {
        vacancyId,
        documentNumber,
      },
    });
    return found ? this.mapToRecord(found) : null;
  }

  async updateStage(
    id: string,
    stage: CandidateStage,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord> {
    const client = tx ?? this.prisma;
    const updated = await client.candidate.updateMany({
      where: {
        id,
        version: expectedVersion,
      },
      data: {
        stage,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new CandidateVersionConflictError();
    }

    const reloaded = await client.candidate.findUniqueOrThrow({ where: { id } });
    return this.mapToRecord(reloaded);
  }

  async updateDecision(
    id: string,
    decision: CandidateDecision,
    decisionNotes: string | null,
    decidedBy: string,
    decidedAt: Date,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord> {
    const client = tx ?? this.prisma;
    const updated = await client.candidate.updateMany({
      where: {
        id,
        version: expectedVersion,
      },
      data: {
        decision,
        decisionNotes,
        decidedBy,
        decidedAt,
        stage: CandidateStage.DECISION,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new CandidateVersionConflictError();
    }

    const reloaded = await client.candidate.findUniqueOrThrow({ where: { id } });
    return this.mapToRecord(reloaded);
  }

  async listByVacancy(vacancyId: string, tx?: Prisma.TransactionClient): Promise<CandidateRecord[]> {
    const client = tx ?? this.prisma;
    const found = await client.candidate.findMany({
      where: { vacancyId },
      orderBy: { createdAt: 'desc' },
    });
    return found.map((f) => this.mapToRecord(f));
  }
}
