import { Injectable } from '@nestjs/common';
import type { Prisma, CandidateInterview } from '@prisma/client';
import { InterviewResult } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CandidateInterviewRecord,
  CreateInterviewInput,
  InterviewRepositoryPort,
  RecordInterviewResultInput,
} from '../../application/ports/interview-repository.port';

@Injectable()
export class PrismaInterviewRepository implements InterviewRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private mapToRecord(entity: CandidateInterview): CandidateInterviewRecord {
    return {
      id: entity.id,
      candidateId: entity.candidateId,
      scheduledAt: entity.scheduledAt,
      isVirtual: entity.isVirtual,
      meetUrl: entity.meetUrl,
      location: entity.location,
      interviewerId: entity.interviewerId,
      qualitativeNotes: entity.qualitativeNotes,
      result: entity.result,
      evaluatedAt: entity.evaluatedAt,
      createdAt: entity.createdAt,
    };
  }

  async create(input: CreateInterviewInput, tx?: Prisma.TransactionClient): Promise<CandidateInterviewRecord> {
    const client = tx ?? this.prisma;
    const created = await client.candidateInterview.create({
      data: {
        candidateId: input.candidateId,
        scheduledAt: input.scheduledAt,
        isVirtual: input.isVirtual,
        meetUrl: input.meetUrl ?? null,
        location: input.location ?? null,
        interviewerId: input.interviewerId,
        result: InterviewResult.PENDIENTE,
      },
    });
    return this.mapToRecord(created);
  }

  async findScopedById(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string; branchId: string },
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateInterviewRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.candidateInterview.findFirst({
      where: {
        id,
        candidate: {
          organizationId: scope.organizationId,
          operatingCompanyId: scope.operatingCompanyId,
          vacancy: { branchId: scope.branchId },
        },
      },
    });
    return found ? this.mapToRecord(found) : null;
  }

  async recordResult(
    id: string,
    input: RecordInterviewResultInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateInterviewRecord> {
    const client = tx ?? this.prisma;
    const updated = await client.candidateInterview.update({
      where: { id },
      data: {
        result: input.result,
        qualitativeNotes: input.qualitativeNotes,
        evaluatedAt: input.evaluatedAt,
      },
    });
    return this.mapToRecord(updated);
  }

  async listByCandidate(candidateId: string, tx?: Prisma.TransactionClient): Promise<CandidateInterviewRecord[]> {
    const client = tx ?? this.prisma;
    const items = await client.candidateInterview.findMany({
      where: { candidateId },
      orderBy: { scheduledAt: 'desc' },
    });
    return items.map((i) => this.mapToRecord(i));
  }
}
