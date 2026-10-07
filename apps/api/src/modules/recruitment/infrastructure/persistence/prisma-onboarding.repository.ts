import { Injectable } from '@nestjs/common';
import type { Prisma, EmployeeOnboarding } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CompleteOnboardingInput,
  EvaluateProbationInput,
  OnboardingRecord,
  OnboardingRepositoryPort,
} from '../../application/ports/onboarding-repository.port';

@Injectable()
export class PrismaOnboardingRepository implements OnboardingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private mapToRecord(entity: EmployeeOnboarding): OnboardingRecord {
    return {
      id: entity.id,
      candidateId: entity.candidateId,
      startDate: entity.startDate,
      inductionScheduled: entity.inductionScheduled,
      equipmentAssigned: entity.equipmentAssigned,
      responsibilityCardSigned: entity.responsibilityCardSigned,
      notarizedContractSigned: entity.notarizedContractSigned,
      isCompleted: entity.isCompleted,
      completedAt: entity.completedAt,
      probationPassed: entity.probationPassed,
      probationEvaluation: entity.probationEvaluation,
      probationEvaluatedAt: entity.probationEvaluatedAt,
      probationEvaluatedBy: entity.probationEvaluatedBy,
      completedBy: entity.completedBy,
      createdAt: entity.createdAt,
    };
  }

  async complete(input: CompleteOnboardingInput, tx?: Prisma.TransactionClient): Promise<OnboardingRecord> {
    const client = tx ?? this.prisma;
    const upserted = await client.employeeOnboarding.upsert({
      where: { candidateId: input.candidateId },
      create: {
        candidateId: input.candidateId,
        startDate: input.startDate,
        inductionScheduled: input.inductionScheduled,
        equipmentAssigned: input.equipmentAssigned,
        responsibilityCardSigned: input.responsibilityCardSigned,
        notarizedContractSigned: input.notarizedContractSigned,
        isCompleted: true,
        completedAt: input.completedAt,
        completedBy: input.completedBy,
      },
      update: {
        startDate: input.startDate,
        inductionScheduled: input.inductionScheduled,
        equipmentAssigned: input.equipmentAssigned,
        responsibilityCardSigned: input.responsibilityCardSigned,
        notarizedContractSigned: input.notarizedContractSigned,
        isCompleted: true,
        completedAt: input.completedAt,
        completedBy: input.completedBy,
      },
    });

    return this.mapToRecord(upserted);
  }

  async findByCandidateId(candidateId: string, tx?: Prisma.TransactionClient): Promise<OnboardingRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.employeeOnboarding.findUnique({
      where: { candidateId },
    });
    return found ? this.mapToRecord(found) : null;
  }

  async evaluateProbation(
    candidateId: string,
    input: EvaluateProbationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<OnboardingRecord> {
    const client = tx ?? this.prisma;
    const updated = await client.employeeOnboarding.update({
      where: { candidateId },
      data: {
        probationPassed: input.passed,
        probationEvaluation: input.qualitativeEvaluation,
        probationEvaluatedAt: input.evaluatedAt,
        probationEvaluatedBy: input.evaluatedBy,
      },
    });
    return this.mapToRecord(updated);
  }
}
