import { Injectable } from '@nestjs/common';
import type { Prisma, Candidate, CandidateNegotiation } from '@prisma/client';
import { CandidateDecision, CandidateStage } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CandidateDetailRecord,
  CandidateRecord,
  CandidateRepositoryPort,
  CreateCandidateInput,
  CreateNegotiationInput,
  NegotiationRecord,
  RecruitmentRepositoryScope,
  SetCandidateCvInput,
} from '../../application/ports/candidate-repository.port';
import type { CandidateProcessState } from '../../domain/recruitment-domain-types';
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
      cv: entity.cvObjectUrl
        ? {
            objectUrl: entity.cvObjectUrl,
            fileName: entity.cvFileName ?? 'cv',
            contentType: entity.cvContentType ?? 'application/octet-stream',
            sizeBytes: entity.cvSizeBytes ?? 0,
            uploadedAt: entity.cvUploadedAt ?? entity.updatedAt,
            uploadedBy: entity.cvUploadedBy,
          }
        : null,
      hasCv: Boolean(entity.cvObjectUrl),
      salaryExpectation: entity.salaryExpectation != null ? Number(entity.salaryExpectation) : null,
      stage: entity.stage,
      processState: entity.processState,
      processStateChangedAt: entity.processStateChangedAt,
      decision: entity.decision,
      decisionNotes: entity.decisionNotes,
      decidedBy: entity.decidedBy,
      decidedAt: entity.decidedAt,
      version: entity.version,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private mapNegotiation(entity: CandidateNegotiation): NegotiationRecord {
    const num = (value: unknown) => (value != null ? Number(value) : null);
    return {
      id: entity.id,
      candidateId: entity.candidateId,
      offeredSalary: Number(entity.offeredSalary),
      offeredSchedule: entity.offeredSchedule,
      offeredOtherConditions: entity.offeredOtherConditions,
      candidateSalary: num(entity.candidateSalary),
      candidateSchedule: entity.candidateSchedule,
      candidateOtherConditions: entity.candidateOtherConditions,
      candidateStartDate: entity.candidateStartDate,
      outcome: entity.outcome,
      agreedSalary: num(entity.agreedSalary),
      agreedConditions: entity.agreedConditions,
      reason: entity.reason,
      recordedBy: entity.recordedBy,
      createdAt: entity.createdAt,
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

  async findDetailById(
    id: string,
    scope: RecruitmentRepositoryScope,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateDetailRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.candidate.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
        vacancy: { branchId: scope.branchId },
      },
      include: {
        interviews: {
          orderBy: { scheduledAt: 'desc' },
        },
        onboarding: true,
        negotiations: { orderBy: { createdAt: 'desc' } },
        vacancy: { select: { isMechanic: true } },
      },
    });
    if (!found) {
      return null;
    }

    return {
      ...this.mapToRecord(found),
      isMechanic: found.vacancy.isMechanic,
      negotiations: found.negotiations.map((n) => this.mapNegotiation(n)),
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
            probationMonthlyFee:
              found.onboarding.probationMonthlyFee != null ? Number(found.onboarding.probationMonthlyFee) : null,
            postProbationMonthlySalary:
              found.onboarding.postProbationMonthlySalary != null
                ? Number(found.onboarding.postProbationMonthlySalary)
                : null,
            probationFeeNotes: found.onboarding.probationFeeNotes,
            probationFeesRecordedAt: found.onboarding.probationFeesRecordedAt,
            probationFeesRecordedBy: found.onboarding.probationFeesRecordedBy,
            // Default-deny: el handler decide la visibilidad segun el permiso del solicitante.
            feesVisible: false,
            version: found.onboarding.version,
            completedBy: found.onboarding.completedBy,
            createdAt: found.onboarding.createdAt,
          }
        : null,
    };
  }

  async findScopedById(
    id: string,
    scope: RecruitmentRepositoryScope,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.candidate.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
        vacancy: { branchId: scope.branchId },
      },
    });
    return found ? this.mapToRecord(found) : null;
  }

  async setCv(
    id: string,
    input: SetCandidateCvInput,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord> {
    const client = tx ?? this.prisma;
    const updated = await client.candidate.updateMany({
      where: { id, version: expectedVersion },
      data: {
        cvObjectUrl: input.objectUrl,
        cvFileName: input.fileName,
        cvContentType: input.contentType,
        cvSizeBytes: input.sizeBytes,
        cvUploadedAt: input.uploadedAt,
        cvUploadedBy: input.uploadedBy,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new CandidateVersionConflictError();
    }
    const reloaded = await client.candidate.findUniqueOrThrow({ where: { id } });
    return this.mapToRecord(reloaded);
  }

  async addNegotiation(input: CreateNegotiationInput, tx?: Prisma.TransactionClient): Promise<NegotiationRecord> {
    const client = tx ?? this.prisma;
    const created = await client.candidateNegotiation.create({
      data: {
        candidateId: input.candidateId,
        offeredSalary: input.offeredSalary,
        offeredSchedule: input.offeredSchedule ?? null,
        offeredOtherConditions: input.offeredOtherConditions ?? null,
        candidateSalary: input.candidateSalary ?? null,
        candidateSchedule: input.candidateSchedule ?? null,
        candidateOtherConditions: input.candidateOtherConditions ?? null,
        candidateStartDate: input.candidateStartDate ?? null,
        outcome: input.outcome,
        agreedSalary: input.agreedSalary ?? null,
        agreedConditions: input.agreedConditions ?? null,
        reason: input.reason ?? null,
        recordedBy: input.recordedBy,
      },
    });
    return this.mapNegotiation(created);
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
    processState: CandidateProcessState,
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
        processState,
        processStateChangedAt: decidedAt,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new CandidateVersionConflictError();
    }

    const reloaded = await client.candidate.findUniqueOrThrow({ where: { id } });
    return this.mapToRecord(reloaded);
  }

  async updateProcessState(
    id: string,
    from: CandidateProcessState,
    to: CandidateProcessState,
    changedAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord> {
    const client = tx ?? this.prisma;
    const updated = await client.candidate.updateMany({
      where: { id, processState: from },
      data: { processState: to, processStateChangedAt: changedAt },
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
