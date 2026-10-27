import {
  CandidateDecision,
  CandidateProcessState,
  CandidateStage,
  NegotiationOutcome,
  VacancyStatus,
} from './recruitment-domain-types';
import {
  CandidateAlreadyDecidedError,
  CandidateCvInvalidFileError,
  CandidateCvObjectMismatchError,
  NegotiationInvalidError,
  VacancyNotPausableError,
  CandidateStageRegressionError,
  CandidateStateTransitionError,
  MechanicMissingTechnicalChannelsError,
  MechanicGeneralPortalsProhibitedError,
  OnboardingChecklistIncompleteError,
  OnboardingMissingNotarizedContractError,
  VacancyNotTransitionableError,
  VacancyNotCancellableError,
  VacancyCancelReasonRequiredError,
} from './recruitment-errors';

// BDD-REC-001 §11.6: Necesidad registrada -> Publicado -> En negociación -> Entrevistado -> Decidido.
// "Decidido" solo se alcanza desde "Entrevistado". CANCELADA/PAUSADA son estados operativos de la vacante (REC-02).
const ALLOWED_VACANCY_TRANSITIONS: Record<VacancyStatus, readonly VacancyStatus[]> = {
  NECESIDAD_REGISTRADA: [VacancyStatus.PUBLICADA, VacancyStatus.CANCELADA],
  PUBLICADA: [VacancyStatus.EN_NEGOCIACION, VacancyStatus.PAUSADA, VacancyStatus.CANCELADA],
  EN_NEGOCIACION: [VacancyStatus.ENTREVISTADA, VacancyStatus.CANCELADA],
  ENTREVISTADA: [VacancyStatus.DECIDIDA, VacancyStatus.CANCELADA],
  // REC-02 "Pausar": solo se pausa una convocatoria activa; reanudar vuelve a PUBLICADA (sin reeditar el perfil).
  PAUSADA: [VacancyStatus.PUBLICADA, VacancyStatus.CANCELADA],
  DECIDIDA: [],
  CANCELADA: [],
};

/** Orden del avance de la vacante por el flujo §11.6 (los estados operativos PAUSADA/CANCELADA no participan). */
const VACANCY_PROGRESS_RANK: Partial<Record<VacancyStatus, number>> = {
  PUBLICADA: 1,
  EN_NEGOCIACION: 2,
  ENTREVISTADA: 3,
  DECIDIDA: 4,
};

/**
 * Avance automático de la vacante cuando un candidato progresa (registrar candidato -> EN_NEGOCIACION,
 * resultado de entrevista -> ENTREVISTADA, contratación -> DECIDIDA). Es monótono: devuelve `target` solo si
 * la vacante está activa y `target` está estrictamente más adelante; si no, null (nada que hacer). Un candidato
 * descartado nunca hace retroceder la vacante (EX-REC-001/002: la vacante sigue abierta).
 */
export function resolveVacancyProgress(current: VacancyStatus, target: VacancyStatus): VacancyStatus | null {
  const from = VACANCY_PROGRESS_RANK[current];
  const to = VACANCY_PROGRESS_RANK[target];
  if (from === undefined || to === undefined || to <= from) {
    return null;
  }
  return target;
}

// BDD-REC-001 §11.6 (columna "Salidas permitidas"). PLANILLA -> TERMINADO está marcado "(futuro)" en el BDD:
// no se habilita. Los estados terminales no admiten salidas.
const ALLOWED_PROCESS_TRANSITIONS: Record<CandidateProcessState, readonly CandidateProcessState[]> = {
  EN_NEGOCIACION: [CandidateProcessState.ENTREVISTADO, CandidateProcessState.DESCARTADO],
  ENTREVISTADO: [CandidateProcessState.DECIDIDO],
  DECIDIDO: [CandidateProcessState.INGRESADO, CandidateProcessState.DESCARTADO],
  INGRESADO: [CandidateProcessState.PERIODO_PRUEBA],
  PERIODO_PRUEBA: [CandidateProcessState.PLANILLA, CandidateProcessState.TERMINADO],
  PLANILLA: [],
  DESCARTADO: [],
  TERMINADO: [],
};

export function canTransitionCandidateProcess(from: CandidateProcessState, to: CandidateProcessState): boolean {
  return (ALLOWED_PROCESS_TRANSITIONS[from] ?? []).includes(to);
}

/** Valida una transición del flujo §11.6; permanecer en el mismo estado no es una transición (error). */
export function assertCandidateProcessTransition(from: CandidateProcessState, to: CandidateProcessState): void {
  if (!canTransitionCandidateProcess(from, to)) {
    throw new CandidateStateTransitionError(from, to);
  }
}

/**
 * Camino de estados que recorre una decisión (todas las transiciones deben ser válidas):
 * - CONTRATADO: ENTREVISTADO -> DECIDIDO.
 * - RECHAZADO tras la entrevista: ENTREVISTADO -> DECIDIDO -> DESCARTADO ("Decidido: salidas Ingresado, Descartado").
 * - RECHAZADO sin entrevista: EN_NEGOCIACION -> DESCARTADO ("En negociación: salidas Entrevistado, Descartado").
 * Devuelve el estado final; lanza CANDIDATE_STATE_TRANSITION_INVALID si algún paso no es válido.
 */
export function resolveDecisionProcessState(
  current: CandidateProcessState,
  decision: CandidateDecision,
): CandidateProcessState {
  if (decision === CandidateDecision.CONTRATADO) {
    assertCandidateProcessTransition(current, CandidateProcessState.DECIDIDO);
    return CandidateProcessState.DECIDIDO;
  }
  if (current === CandidateProcessState.ENTREVISTADO) {
    assertCandidateProcessTransition(current, CandidateProcessState.DECIDIDO);
    assertCandidateProcessTransition(CandidateProcessState.DECIDIDO, CandidateProcessState.DESCARTADO);
  } else {
    assertCandidateProcessTransition(current, CandidateProcessState.DESCARTADO);
  }
  return CandidateProcessState.DESCARTADO;
}

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

/** Estados desde los que se puede cancelar sin dejar candidatos en proceso colgados (EN_NEGOCIACION en adelante ya los tiene). */
const CANCELLABLE_VACANCY_STATUSES: readonly VacancyStatus[] = [
  VacancyStatus.NECESIDAD_REGISTRADA,
  VacancyStatus.PUBLICADA,
  VacancyStatus.PAUSADA,
];

/** REC-02 cancelar: solo NECESIDAD_REGISTRADA / PUBLICADA / PAUSADA, y ademas debe ser una transicion valida de la tabla. */
export function assertVacancyCancellable(currentStatus: VacancyStatus): void {
  if (!CANCELLABLE_VACANCY_STATUSES.includes(currentStatus)) {
    throw new VacancyNotCancellableError(currentStatus);
  }
  assertValidVacancyTransition(currentStatus, VacancyStatus.CANCELADA);
}

export const VACANCY_CANCEL_REASON_MIN_LENGTH = 5;
export const VACANCY_CANCEL_REASON_MAX_LENGTH = 500;

/** Motivo obligatorio (5 a 500 caracteres, sin contar espacios sobrantes). Devuelve el motivo recortado. */
export function assertVacancyCancelReason(reason: string | null | undefined): string {
  const trimmed = (reason ?? '').trim();
  if (trimmed.length < VACANCY_CANCEL_REASON_MIN_LENGTH || trimmed.length > VACANCY_CANCEL_REASON_MAX_LENGTH) {
    throw new VacancyCancelReasonRequiredError();
  }
  return trimmed;
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

/** Texto sin tildes ni mayusculas, espacios colapsados: «Institutos Técnicos» -> «institutos tecnicos». */
export function normalizeChannelText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * BR-REC-004: canales tecnicos admitidos para una vacante de mecanico. 22-oct: el front envia «Institutos técnicos»; ademas de los
 * nombres propios SENATI / TECSUP se acepta ese texto (normalizado: sin tildes ni mayusculas, singular o plural).
 */
export function isTechnicalChannel(channel: string): boolean {
  const normalized = normalizeChannelText(channel);
  return (
    normalized.includes('senati') ||
    normalized.includes('tecsup') ||
    /\binstituto(s)? tecnico(s)?\b/.test(normalized)
  );
}

/** Portales generales de empleo prohibidos para vacantes de mecánico (Ficha AS-IS, BDD-05). */
export function isGeneralPortal(channel: string): boolean {
  const normalized = normalizeChannelText(channel);
  return (
    normalized.includes('bumeran') ||
    normalized.includes('computrabajo') ||
    normalized.includes('linkedin') ||
    normalized.includes('unch')
  );
}

export function assertMechanicChannels(isMechanic: boolean, channels: string[]): void {
  if (!isMechanic) {
    return;
  }
  const generalPortal = channels.find(isGeneralPortal);
  if (generalPortal) {
    throw new MechanicGeneralPortalsProhibitedError(generalPortal);
  }

  const hasTechnicalChannel = channels.some(isTechnicalChannel);
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
