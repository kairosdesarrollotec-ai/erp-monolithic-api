import { CandidateDecision, CandidateStage, VacancyStatus } from '@prisma/client';
import {
  CandidateAlreadyDecidedError,
  CandidateStageRegressionError,
  MechanicMissingTechnicalChannelsError,
  OnboardingChecklistIncompleteError,
  OnboardingMissingNotarizedContractError,
  VacancyNotTransitionableError,
} from './recruitment-errors';

const ALLOWED_VACANCY_TRANSITIONS: Record<VacancyStatus, readonly VacancyStatus[]> = {
  NECESIDAD_REGISTRADA: [VacancyStatus.PUBLICADA, VacancyStatus.CANCELADA],
  PUBLICADA: [VacancyStatus.EN_NEGOCIACION, VacancyStatus.DECIDIDA, VacancyStatus.CANCELADA],
  EN_NEGOCIACION: [VacancyStatus.DECIDIDA, VacancyStatus.CANCELADA],
  DECIDIDA: [],
  CANCELADA: [],
};

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
    salaryExpectation?: number | null;
  },
>(candidate: T, canViewSensitive: boolean): T & { isRestrictedView: boolean } {
  if (!canViewSensitive) {
    return {
      ...candidate,
      email: null,
      phone: null,
      cvDocumentId: null,
      salaryExpectation: null,
      isRestrictedView: true,
    };
  }
  return {
    ...candidate,
    isRestrictedView: false,
  };
}
