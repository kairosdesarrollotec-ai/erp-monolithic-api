import { CandidateDecision, CandidateStage, NegotiationOutcome, VacancyStatus } from '@prisma/client';
import {
  CandidateAlreadyDecidedError,
  CandidateCvInvalidFileError,
  CandidateCvObjectMismatchError,
  NegotiationInvalidError,
  VacancyNotPausableError,
  CandidateStageRegressionError,
  MechanicMissingTechnicalChannelsError,
  OnboardingChecklistIncompleteError,
  OnboardingMissingNotarizedContractError,
  VacancyNotTransitionableError,
} from './recruitment-errors';

const ALLOWED_VACANCY_TRANSITIONS: Record<VacancyStatus, readonly VacancyStatus[]> = {
  NECESIDAD_REGISTRADA: [VacancyStatus.PUBLICADA, VacancyStatus.CANCELADA],
  PUBLICADA: [VacancyStatus.EN_NEGOCIACION, VacancyStatus.DECIDIDA, VacancyStatus.PAUSADA, VacancyStatus.CANCELADA],
  EN_NEGOCIACION: [VacancyStatus.DECIDIDA, VacancyStatus.CANCELADA],
  // REC-02 "Pausar": solo se pausa una convocatoria activa; reanudar vuelve a PUBLICADA (sin reeditar el perfil).
  PAUSADA: [VacancyStatus.PUBLICADA, VacancyStatus.CANCELADA],
  DECIDIDA: [],
  CANCELADA: [],
};

/** Pausar solo aplica a una vacante PUBLICADA. */
export function assertVacancyPausable(currentStatus: VacancyStatus): void {
  if (currentStatus !== VacancyStatus.PUBLICADA) {
    throw new VacancyNotPausableError(currentStatus, 'pausar');
  }
}

/** Reanudar solo aplica a una vacante PAUSADA. */
export function assertVacancyResumable(currentStatus: VacancyStatus): void {
  if (currentStatus !== VacancyStatus.PAUSADA) {
    throw new VacancyNotPausableError(currentStatus, 'reanudar');
  }
}

export function assertValidVacancyTransition(currentStatus: VacancyStatus, targetStatus: VacancyStatus): void {
  if (currentStatus === targetStatus) {
    return;
  }
  const allowed = ALLOWED_VACANCY_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new VacancyNotTransitionableError(currentStatus, targetStatus);
  }
}

export function assertMechanicChannels(isMechanic: boolean, channels: string[]): void {
  if (!isMechanic) {
    return;
  }
  const hasTechnicalChannel = channels.some((channel) => {
    const upper = channel.toUpperCase();
    return upper.includes('SENATI') || upper.includes('TECSUP');
  });

  if (!hasTechnicalChannel) {
    throw new MechanicMissingTechnicalChannelsError();
  }
}

export function assertCandidateNotDecided(decision: CandidateDecision | null | undefined): void {
  if (decision !== null && decision !== undefined) {
    throw new CandidateAlreadyDecidedError(decision);
  }
}

const STAGE_ORDER: Record<CandidateStage, number> = {
  NUEVO: 1,
  CONTACTADO: 2,
  ENTREVISTA: 3,
  DECISION: 4,
};

export function assertCandidateStageTransition(currentStage: CandidateStage, targetStage: CandidateStage): void {
  if (currentStage === targetStage) {
    return;
  }
  if (STAGE_ORDER[targetStage] <= STAGE_ORDER[currentStage]) {
    throw new CandidateStageRegressionError(currentStage, targetStage);
  }
}

export interface OnboardingChecklistInput {
  startDate: Date | string;
  inductionScheduled: boolean;
  equipmentAssigned: boolean;
  responsibilityCardSigned: boolean;
  notarizedContractSigned?: boolean;
}

export function assertOnboardingValid(isMechanic: boolean, input: OnboardingChecklistInput): void {
  if (!input.inductionScheduled || !input.equipmentAssigned || !input.responsibilityCardSigned) {
    throw new OnboardingChecklistIncompleteError();
  }
  if (isMechanic && !input.notarizedContractSigned) {
    throw new OnboardingMissingNotarizedContractError();
  }
}

export function maskCandidateSensitiveFields<
  T extends {
    email?: string | null;
    phone?: string | null;
    cvDocumentId?: string | null;
    cv?: unknown;
    negotiations?: unknown[];
    onboarding?: unknown;
    salaryExpectation?: number | null;
  },
>(candidate: T, canViewSensitive: boolean): T & { isRestrictedView: boolean } {
  if (!canViewSensitive) {
    return {
      ...candidate,
      email: null,
      phone: null,
      cvDocumentId: null,
      cv: null,
      salaryExpectation: null,
      // REC-04: la negociacion y los honorarios del periodo de prueba son datos sensibles/financieros.
      ...(candidate.negotiations !== undefined ? { negotiations: [] } : {}),
      ...(candidate.onboarding ? { onboarding: applyOnboardingFeeVisibility(candidate.onboarding as FeeBearing, false) } : {}),
      isRestrictedView: true,
    };
  }
  return {
    ...candidate,
    ...(candidate.onboarding ? { onboarding: applyOnboardingFeeVisibility(candidate.onboarding as FeeBearing, true) } : {}),
    isRestrictedView: false,
  };
}

interface FeeBearing {
  probationMonthlyFee: number | null;
  postProbationMonthlySalary: number | null;
  probationFeeNotes: string | null;
  probationFeesRecordedAt: Date | null;
  probationFeesRecordedBy: string | null;
  feesVisible: boolean;
}

/**
 * REC-08 / DAT-REC-007 (financiera): los honorarios solo se exponen a quien puede ver datos sensibles.
 * Sin permiso se anulan y `feesVisible` queda en false (el mapper nunca los emite).
 */
export function applyOnboardingFeeVisibility<T extends FeeBearing>(onboarding: T, canView: boolean): T {
  if (canView) {
    return { ...onboarding, feesVisible: true };
  }
  return {
    ...onboarding,
    probationMonthlyFee: null,
    postProbationMonthlySalary: null,
    probationFeeNotes: null,
    probationFeesRecordedAt: null,
    probationFeesRecordedBy: null,
    feesVisible: false,
  };
}

/** DAT-REC-004 - CV: PDF, Word o imagen escaneada. Maximo 10 MB (supuesto operativo, no definido en BDD). */
export const CANDIDATE_CV_MAX_BYTES = 10 * 1024 * 1024;
export const CANDIDATE_CV_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
] as const;
export type CandidateCvContentType = (typeof CANDIDATE_CV_CONTENT_TYPES)[number];

export function isCandidateCvContentType(value: string): value is CandidateCvContentType {
  return (CANDIDATE_CV_CONTENT_TYPES as readonly string[]).includes(value);
}

export function assertCandidateCvFile(contentType: string, sizeBytes: number): void {
  if (!isCandidateCvContentType(contentType)) {
    throw new CandidateCvInvalidFileError('El CV debe ser un PDF, un documento Word (.docx) o una imagen JPG/PNG.');
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw new CandidateCvInvalidFileError('El archivo del CV está vacío.');
  }
  if (sizeBytes > CANDIDATE_CV_MAX_BYTES) {
    throw new CandidateCvInvalidFileError(
      `El CV supera el tamaño máximo permitido de ${Math.round(CANDIDATE_CV_MAX_BYTES / (1024 * 1024))} MB.`,
    );
  }
}

/** El objeto registrado debe haber sido generado por la sesión de subida de ESTE candidato y empresa. */
export function assertCandidateCvObjectOwned(owned: boolean): void {
  if (!owned) {
    throw new CandidateCvObjectMismatchError();
  }
}

/** Nombre de archivo seguro para mostrar: sin rutas ni caracteres de control. */
export function sanitizeCvFileName(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const base = raw.replace(/[\u0000-\u001f\u007f]/g, '').split(/[\\/]/).pop()?.trim() ?? '';
  return base.slice(0, 200) || 'cv';
}

export interface NegotiationInput {
  outcome: NegotiationOutcome;
  offeredSalary: number;
  candidateSalary?: number | null;
  agreedSalary?: number | null;
  reason?: string | null;
}

/** REC-04: reglas de una ronda de negociacion. Montos >= 0; ACORDADA exige monto acordado; NO_ACORDADA exige motivo. */
export function assertNegotiationValid(input: NegotiationInput): void {
  const amounts: Array<[string, number | null | undefined]> = [
    ['El sueldo ofrecido', input.offeredSalary],
    ['La pretensión del candidato', input.candidateSalary],
    ['El sueldo acordado', input.agreedSalary],
  ];
  for (const [label, value] of amounts) {
    if (value !== null && value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new NegotiationInvalidError(`${label} debe ser un monto válido (mayor o igual a 0).`);
    }
  }
  if (input.outcome === NegotiationOutcome.ACORDADA && (input.agreedSalary === null || input.agreedSalary === undefined)) {
    throw new NegotiationInvalidError('Para acordar las condiciones indica el sueldo acordado.');
  }
  if (input.outcome !== NegotiationOutcome.ACORDADA && input.agreedSalary !== null && input.agreedSalary !== undefined) {
    throw new NegotiationInvalidError('El sueldo acordado solo se registra cuando las condiciones quedan acordadas.');
  }
  if (input.outcome === NegotiationOutcome.NO_ACORDADA && !(input.reason && input.reason.trim().length > 0)) {
    throw new NegotiationInvalidError('Indica el motivo cuando las condiciones no se acuerdan.');
  }
}
