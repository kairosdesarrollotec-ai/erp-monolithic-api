import type { Prisma } from '@prisma/client';

export interface OnboardingRecord {
  id: string;
  candidateId: string;
  startDate: Date;
  inductionScheduled: boolean;
  equipmentAssigned: boolean;
  responsibilityCardSigned: boolean;
  notarizedContractSigned: boolean;
  isCompleted: boolean;
  completedAt: Date | null;
  probationPassed: boolean | null;
  probationEvaluation: string | null;
  probationEvaluatedAt: Date | null;
  probationEvaluatedBy: string | null;
  completedBy: string | null;
  createdAt: Date;
}

export interface CompleteOnboardingInput {
  candidateId: string;
  startDate: Date;
  inductionScheduled: boolean;
  equipmentAssigned: boolean;
  responsibilityCardSigned: boolean;
  notarizedContractSigned: boolean;
  completedAt: Date;
  completedBy: string;
}

export interface EvaluateProbationInput {
  passed: boolean;
  qualitativeEvaluation: string;
  evaluatedAt: Date;
  evaluatedBy: string;
}

export abstract class OnboardingRepositoryPort {
  abstract complete(input: CompleteOnboardingInput, tx?: Prisma.TransactionClient): Promise<OnboardingRecord>;
  abstract findByCandidateId(candidateId: string, tx?: Prisma.TransactionClient): Promise<OnboardingRecord | null>;
  abstract evaluateProbation(
    candidateId: string,
    input: EvaluateProbationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<OnboardingRecord>;
}
