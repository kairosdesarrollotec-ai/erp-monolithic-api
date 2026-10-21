import type { Prisma, CandidateStage, CandidateDecision, NegotiationOutcome } from '@prisma/client';
import type { CandidateProcessState } from '../../domain/recruitment-domain-types';
import type { CandidateInterviewRecord } from './interview-repository.port';
import type { OnboardingRecord } from './onboarding-repository.port';

/** DAT-REC-004 - metadatos del archivo del CV (el binario vive en almacenamiento privado). */
export interface CandidateCvRecord {
  objectUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: Date;
  uploadedBy: string | null;
}

/** REC-04 - una ronda de negociacion (historial append-only). */
export interface NegotiationRecord {
  id: string;
  candidateId: string;
  offeredSalary: number;
  offeredSchedule: string | null;
  offeredOtherConditions: string | null;
  candidateSalary: number | null;
  candidateSchedule: string | null;
  candidateOtherConditions: string | null;
  candidateStartDate: Date | null;
  outcome: NegotiationOutcome;
  agreedSalary: number | null;
  agreedConditions: string | null;
  reason: string | null;
  recordedBy: string;
  createdAt: Date;
}

export interface CreateNegotiationInput {
  candidateId: string;
  offeredSalary: number;
  offeredSchedule?: string | null;
  offeredOtherConditions?: string | null;
  candidateSalary?: number | null;
  candidateSchedule?: string | null;
  candidateOtherConditions?: string | null;
  candidateStartDate?: Date | null;
  outcome: NegotiationOutcome;
  agreedSalary?: number | null;
  agreedConditions?: string | null;
  reason?: string | null;
  recordedBy: string;
}

export interface SetCandidateCvInput {
  objectUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface CandidateRecord {
  id: string;
  vacancyId: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string | null;
  phone: string | null;
  cvDocumentId: string | null;
  /** Archivo del CV cargado; null si aun no se subio (o si la vista es restringida). */
  cv: CandidateCvRecord | null;
  /** true si hay un CV cargado (visible incluso en vista restringida para mostrar el candado). */
  hasCv: boolean;
  salaryExpectation: number | null;
  stage: CandidateStage;
  /** BDD-REC §11.6 - estado normativo del proceso (la etapa Kanban `stage` es solo presentación del tablero). */
  processState: CandidateProcessState;
  processStateChangedAt: Date | null;
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
  /** REC-04: historial de negociacion (vacio si la vista es restringida). */
  negotiations: NegotiationRecord[];
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

export interface RecruitmentRepositoryScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export abstract class CandidateRepositoryPort {
  abstract create(input: CreateCandidateInput, tx?: Prisma.TransactionClient): Promise<CandidateRecord>;
  /**
   * Detalle del candidato acotado a organizacion/empresa/sede de su vacante. No existe busqueda por id sin
   * alcance: un id de otra sede/empresa debe resolverse como inexistente (404, no revela existencia).
   */
  abstract findDetailById(
    id: string,
    scope: RecruitmentRepositoryScope,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateDetailRecord | null>;
  /** Candidato acotado a organizacion/empresa/sede de la vacante del candidato. */
  abstract findScopedById(
    id: string,
    scope: RecruitmentRepositoryScope,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord | null>;
  abstract setCv(
    id: string,
    input: SetCandidateCvInput,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord>;
  abstract addNegotiation(input: CreateNegotiationInput, tx?: Prisma.TransactionClient): Promise<NegotiationRecord>;
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
    /** Estado de proceso resultante de la decisión (DECIDIDO o DESCARTADO), se escribe en la misma sentencia. */
    processState: CandidateProcessState,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord>;
  /**
   * Transición del estado de proceso (BDD-REC §11.6) con compare-and-set sobre el estado actual: si otro comando lo
   * cambió entre la lectura y la escritura lanza VERSION_CONFLICT. No incrementa `version` (If-Match del cliente):
   * el estado de proceso es derivado de comandos que ya tienen su propia concurrencia (resultado de entrevista,
   * incorporación, evaluación de prueba).
   */
  abstract updateProcessState(
    id: string,
    from: CandidateProcessState,
    to: CandidateProcessState,
    changedAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<CandidateRecord>;
  abstract listByVacancy(vacancyId: string, tx?: Prisma.TransactionClient): Promise<CandidateRecord[]>;
}
