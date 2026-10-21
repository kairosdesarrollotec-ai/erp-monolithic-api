import type { CandidateProcessState } from '../../../domain/recruitment-domain-types';
import {
  CandidateDecision,
  CandidateStage,
  InterviewResult,
  NegotiationOutcome,
  VacancySource,
  VacancyStatus,
} from '@prisma/client';

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
  /** BDD-REC §11.6 - estado normativo del proceso. */
  processState: CandidateProcessState;
  /** Cuándo cambió por última vez el estado de proceso; null en filas históricas anteriores al flujo de estados. */
  processStateChangedAt: string | null;
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

export interface CandidateCvResponse {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface CandidateCvUploadSessionResponse {
  uploadUrl: string;
  objectUrl: string;
  expiresAt: string;
  uploadHeaders: Record<string, string>;
}

export interface CandidateCvViewResponse extends CandidateCvResponse {
  url: string;
  expiresAt: string;
}

export interface NegotiationResponse {
  id: string;
  candidateId: string;
  outcome: NegotiationOutcome;
  offeredSalary: number;
  offeredSchedule: string | null;
  offeredOtherConditions: string | null;
  candidateSalary: number | null;
  candidateSchedule: string | null;
  candidateOtherConditions: string | null;
  candidateStartDate: string | null;
  agreedSalary: number | null;
  agreedConditions: string | null;
  reason: string | null;
  recordedBy: string;
  createdAt: string;
}

export interface CandidateDetailResponse extends CandidateResponse {
  email: string | null;
  phone: string | null;
  cvDocumentId: string | null;
  /** true si hay un CV cargado (se informa tambien en vista restringida). */
  hasCv: boolean;
  /** Metadatos del CV; null si no hay CV o la vista es restringida. */
  cv: CandidateCvResponse | null;
  /** Historial de negociacion (mas reciente primero); vacio en vista restringida. */
  negotiations: NegotiationResponse[];
  salaryExpectation: number | null;
  decisionNotes: string | null;
  decidedAt: string | null;
  isRestrictedView: boolean;
  /** Heredado de la vacante del candidato. */
  isMechanic: boolean;
  interviews: CandidateInterviewResponse[];
  onboarding: OnboardingResponse | null;
}

export interface InterviewerResponse {
  id: string;
  fullName: string;
}

export interface InterviewerListResponse {
  items: InterviewerResponse[];
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
  /** REC-08 honorarios (financiero): null si no se registraron o `feesRestricted` es true. */
  probationMonthlyFee: number | null;
  postProbationMonthlySalary: number | null;
  probationFeeNotes: string | null;
  probationFeesRecordedAt: string | null;
  /** true si el solicitante no tiene permiso para ver los honorarios. */
  feesRestricted: boolean;
  /** Version para If-Match al registrar honorarios. */
  version: number;
  createdAt: string;
}
