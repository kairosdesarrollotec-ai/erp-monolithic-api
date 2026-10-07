import type { Prisma, InterviewResult } from '@prisma/client';

export interface CandidateInterviewRecord {
  id: string;
  candidateId: string;
  scheduledAt: Date;
  isVirtual: boolean;
  meetUrl: string | null;
  location: string | null;
  interviewerId: string;
  qualitativeNotes: string | null;
  result: InterviewResult;
  evaluatedAt: Date | null;
  createdAt: Date;
}

export interface CreateInterviewInput {
  candidateId: string;
  scheduledAt: Date;
  isVirtual: boolean;
  meetUrl?: string | null;
  location?: string | null;
  interviewerId: string;
}

export interface RecordInterviewResultInput {
  result: InterviewResult;
  qualitativeNotes: string;
  evaluatedAt: Date;
}

export abstract class InterviewRepositoryPort {
  abstract create(input: CreateInterviewInput, tx?: Prisma.TransactionClient): Promise<CandidateInterviewRecord>;
  abstract findById(id: string, tx?: Prisma.TransactionClient): Promise<CandidateInterviewRecord | null>;
  abstract recordResult(
    id: string,
    input: RecordInterviewResultInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateInterviewRecord>;
  abstract listByCandidate(candidateId: string, tx?: Prisma.TransactionClient): Promise<CandidateInterviewRecord[]>;
}
