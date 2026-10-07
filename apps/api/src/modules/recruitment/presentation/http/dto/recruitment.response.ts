import { CandidateDecision, CandidateStage, InterviewResult, VacancySource, VacancyStatus } from '@prisma/client';

export interface VacancyResponse {
  id: string;
  code: string;
  title: string;
  department: string;
  source: VacancySource;
  status: VacancyStatus;
  isMechanic: boolean;
  version: number;
  createdAt: string;
}

export interface VacancyDetailResponse extends VacancyResponse {
  profileDescription: string | null;
  baseSalary: number | null;
  scheduleDetails: string | null;
  publishedChannels: string[];
  candidatesCount: number;
  candidatesByStage: Record<CandidateStage, number>;
}

export interface CandidateResponse {
  id: string;
  vacancyId: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  stage: CandidateStage;
  score: number | null;
  decision: CandidateDecision | null;
  version: number;
  createdAt: string;
}

export interface CandidateInterviewResponse {
  id: string;
  candidateId: string;
  scheduledAt: string;
  isVirtual: boolean;
  meetUrl: string | null;
  location: string | null;
  interviewerId: string;
  qualitativeNotes: string | null;
  result: InterviewResult;
  evaluatedAt: string | null;
  createdAt: string;
}

export interface CandidateDetailResponse extends CandidateResponse {
  email: string | null;
  phone: string | null;
  cvDocumentId: string | null;
  salaryExpectation: number | null;
  decisionNotes: string | null;
  decidedAt: string | null;
  isRestrictedView: boolean;
  interviews: CandidateInterviewResponse[];
  onboarding: OnboardingResponse | null;
}

export interface OnboardingResponse {
  id: string;
  candidateId: string;
  startDate: string;
  inductionScheduled: boolean;
  equipmentAssigned: boolean;
  responsibilityCardSigned: boolean;
  notarizedContractSigned: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  probationPassed: boolean | null;
  probationEvaluation: string | null;
  probationEvaluatedAt: string | null;
  createdAt: string;
}
