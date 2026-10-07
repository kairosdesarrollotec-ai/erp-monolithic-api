import { VacancyDetailRecord, VacancyRecord } from '../../application/ports/vacancy-repository.port';
import { CandidateDetailRecord, CandidateRecord } from '../../application/ports/candidate-repository.port';
import { CandidateInterviewRecord } from '../../application/ports/interview-repository.port';
import { OnboardingRecord } from '../../application/ports/onboarding-repository.port';
import {
  CandidateDetailResponse,
  CandidateInterviewResponse,
  CandidateResponse,
  OnboardingResponse,
  VacancyDetailResponse,
  VacancyResponse,
} from './dto/recruitment.response';

export function toVacancyResponse(record: VacancyRecord): VacancyResponse {
  return {
    id: record.id,
    code: record.code,
    title: record.title,
    department: record.department,
    source: record.source,
    status: record.status,
    isMechanic: record.isMechanic,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toVacancyDetailResponse(record: VacancyDetailRecord): VacancyDetailResponse {
  return {
    ...toVacancyResponse(record),
    profileDescription: record.profileDescription,
    baseSalary: record.baseSalary,
    scheduleDetails: record.scheduleDetails,
    publishedChannels: record.publishedChannels,
    candidatesCount: record.candidatesCount,
    candidatesByStage: record.candidatesByStage,
  };
}

export function toCandidateResponse(record: CandidateRecord): CandidateResponse {
  return {
    id: record.id,
    vacancyId: record.vacancyId,
    fullName: record.fullName,
    documentType: record.documentType,
    documentNumber: record.documentNumber,
    stage: record.stage,
    score: record.score,
    decision: record.decision,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toCandidateInterviewResponse(record: CandidateInterviewRecord): CandidateInterviewResponse {
  return {
    id: record.id,
    candidateId: record.candidateId,
    scheduledAt: record.scheduledAt.toISOString(),
    isVirtual: record.isVirtual,
    meetUrl: record.meetUrl,
    location: record.location,
    interviewerId: record.interviewerId,
    qualitativeNotes: record.qualitativeNotes,
    result: record.result,
    evaluatedAt: record.evaluatedAt ? record.evaluatedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toCandidateDetailResponse(record: CandidateDetailRecord): CandidateDetailResponse {
  return {
    ...toCandidateResponse(record),
    email: record.email,
    phone: record.phone,
    cvDocumentId: record.cvDocumentId,
    salaryExpectation: record.salaryExpectation,
    decisionNotes: record.decisionNotes,
    decidedAt: record.decidedAt ? record.decidedAt.toISOString() : null,
    isRestrictedView: record.isRestrictedView ?? false,
    isMechanic: record.isMechanic,
    interviews: (record.interviews || []).map((i) => toCandidateInterviewResponse(i)),
    onboarding: record.onboarding ? toOnboardingResponse(record.onboarding) : null,
  };
}

export function toOnboardingResponse(record: OnboardingRecord): OnboardingResponse {
  return {
    id: record.id,
    candidateId: record.candidateId,
    startDate: record.startDate.toISOString().slice(0, 10),
    inductionScheduled: record.inductionScheduled,
    equipmentAssigned: record.equipmentAssigned,
    responsibilityCardSigned: record.responsibilityCardSigned,
    notarizedContractSigned: record.notarizedContractSigned,
    isCompleted: record.isCompleted,
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    probationPassed: record.probationPassed,
    probationEvaluation: record.probationEvaluation,
    probationEvaluatedAt: record.probationEvaluatedAt ? record.probationEvaluatedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
  };
}
