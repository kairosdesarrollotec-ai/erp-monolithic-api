import { VacancyDetailRecord, VacancyRecord } from '../../application/ports/vacancy-repository.port';
import { CandidateDetailRecord, CandidateRecord, NegotiationRecord } from '../../application/ports/candidate-repository.port';
import { CandidateCvViewRecord } from '../../application/queries/get-candidate-cv.handler';
import { CandidateCvUploadSession } from '../../application/ports/candidate-cv-storage.port';
import { CandidateInterviewRecord } from '../../application/ports/interview-repository.port';
import { InterviewerRecord } from '../../application/queries/list-interviewers.handler';
import { OnboardingRecord } from '../../application/ports/onboarding-repository.port';
import {
  CandidateCvUploadSessionResponse,
  CandidateCvViewResponse,
  CandidateDetailResponse,
  CandidateInterviewResponse,
  NegotiationResponse,
  CandidateResponse,
  InterviewerListResponse,
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
    originTerminationId: record.originTerminationId,
    originEmployeeId: record.originEmployeeId,
    cancelReason: record.cancelReason,
    cancelledAt: record.cancelledAt ? record.cancelledAt.toISOString() : null,
    cancelledBy: record.cancelledBy,
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
    processState: record.processState,
    processStateChangedAt: record.processStateChangedAt ? record.processStateChangedAt.toISOString() : null,
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
    hasCv: record.hasCv,
    cv: record.cv
      ? {
          fileName: record.cv.fileName,
          contentType: record.cv.contentType,
          sizeBytes: record.cv.sizeBytes,
          uploadedAt: record.cv.uploadedAt.toISOString(),
        }
      : null,
    negotiations: (record.negotiations || []).map((n) => toNegotiationResponse(n)),
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
    // Default-deny: los honorarios solo salen si el handler marco la vista como autorizada.
    probationMonthlyFee: record.feesVisible ? record.probationMonthlyFee : null,
    postProbationMonthlySalary: record.feesVisible ? record.postProbationMonthlySalary : null,
    probationFeeNotes: record.feesVisible ? record.probationFeeNotes : null,
    probationFeesRecordedAt:
      record.feesVisible && record.probationFeesRecordedAt ? record.probationFeesRecordedAt.toISOString() : null,
    feesRestricted: !record.feesVisible,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toNegotiationResponse(record: NegotiationRecord): NegotiationResponse {
  return {
    id: record.id,
    candidateId: record.candidateId,
    outcome: record.outcome,
    offeredSalary: record.offeredSalary,
    offeredSchedule: record.offeredSchedule,
    offeredOtherConditions: record.offeredOtherConditions,
    candidateSalary: record.candidateSalary,
    candidateSchedule: record.candidateSchedule,
    candidateOtherConditions: record.candidateOtherConditions,
    candidateStartDate: record.candidateStartDate ? record.candidateStartDate.toISOString().slice(0, 10) : null,
    agreedSalary: record.agreedSalary,
    agreedConditions: record.agreedConditions,
    reason: record.reason,
    recordedBy: record.recordedBy,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toCandidateCvUploadSessionResponse(session: CandidateCvUploadSession): CandidateCvUploadSessionResponse {
  return {
    uploadUrl: session.uploadUrl,
    objectUrl: session.objectUrl,
    expiresAt: session.expiresAt.toISOString(),
    uploadHeaders: session.uploadHeaders,
  };
}

export function toCandidateCvViewResponse(record: CandidateCvViewRecord): CandidateCvViewResponse {
  return {
    url: record.url,
    expiresAt: record.expiresAt.toISOString(),
    fileName: record.fileName,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
    uploadedAt: record.uploadedAt.toISOString(),
  };
}

export function toInterviewerListResponse(records: InterviewerRecord[]): InterviewerListResponse {
  return { items: records.map((r) => ({ id: r.id, fullName: r.fullName })) };
}
