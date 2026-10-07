import type { Prisma, CandidateStage, CandidateDecision } from '@prisma/client';
import type { CandidateInterviewRecord } from './interview-repository.port';
import type { OnboardingRecord } from './onboarding-repository.port';

export interface CandidateRecord {
  id: string;
  vacancyId: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string | null;
  phone: string | null;
  cvDocumentId: string | null;
  salaryExpectation: number | null;
  stage: CandidateStage;
  score: number | null;
  decision: CandidateDecision | null;
  decisionNotes: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateDetailRecord extends CandidateRecord {
  interviews: CandidateInterviewRecord[];
  onboarding: OnboardingRecord | null;
  /** Tomado de la vacante del candidato (REC-04: define si aplica contrato notarial / canales tecnicos). */
  isMechanic: boolean;
  isRestrictedView?: boolean;
}

export interface CreateCandidateInput {
  vacancyId: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  email?: string | null;
  phone?: string | null;
  cvDocumentId: string;
  salaryExpectation?: number | null;
}

export abstract class CandidateRepositoryPort {
  abstract create(input: CreateCandidateInput, tx?: Prisma.TransactionClient): Promise<CandidateRecord>;
  abstract findById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord | null>;
  abstract findDetailById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateDetailRecord | null>;
  abstract findByDocumentNumber(
    vacancyId: string,
    documentNumber: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord | null>;
  abstract updateStage(
    id: string,
    stage: CandidateStage,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord>;
  abstract updateDecision(
    id: string,
    decision: CandidateDecision,
    decisionNotes: string | null,
    decidedBy: string,
    decidedAt: Date,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord>;
  abstract listByVacancy(vacancyId: string, tx?: Prisma.TransactionClient): Promise<CandidateRecord[]>;
}
