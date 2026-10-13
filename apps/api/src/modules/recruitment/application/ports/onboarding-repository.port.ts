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
  /** REC-08: honorarios del periodo de prueba (financiero). null si no se registraron o la vista es restringida. */
  probationMonthlyFee: number | null;
  postProbationMonthlySalary: number | null;
  probationFeeNotes: string | null;
  probationFeesRecordedAt: Date | null;
  probationFeesRecordedBy: string | null;
  /** true si el solicitante puede ver los honorarios (permiso de datos sensibles). */
  feesVisible: boolean;
  version: number;
  completedBy: string | null;
  createdAt: Date;
}

export interface SetProbationFeesInput {
  probationMonthlyFee: number;
  postProbationMonthlySalary: number | null;
  probationFeeNotes: string | null;
  recordedAt: Date;
  recordedBy: string;
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
  abstract setProbationFees(
    candidateId: string,
    input: SetProbationFeesInput,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<OnboardingRecord>;
  abstract evaluateProbation(
    candidateId: string,
    input: EvaluateProbationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<OnboardingRecord>;
}
