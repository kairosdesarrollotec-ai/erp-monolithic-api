import {
  DomainConflictError,
  DomainNotFoundError,
  DomainUnprocessableError,
} from '../../../common/domain/domain-errors';

export class VacancyNotFoundError extends DomainNotFoundError {
  readonly code = 'VACANCY_NOT_FOUND';

  constructor(id?: string) {
    super(id ? `Vacante ${id} no encontrada en esta empresa/sede.` : 'Vacante no encontrada.');
  }
}

export class VacancyVersionConflictError extends DomainConflictError {
  readonly code = 'VERSION_CONFLICT';

  constructor() {
    super('La vacante fue modificada concurrentemente por otra operación. Recarga los datos.');
  }
}

export class VacancyNotTransitionableError extends DomainUnprocessableError {
  readonly code = 'VACANCY_NOT_TRANSITIONABLE';

  constructor(currentStatus: string, targetStatus: string) {
    super(`No es posible transicionar la vacante de ${currentStatus} a ${targetStatus}.`);
  }
}

export class MechanicMissingTechnicalChannelsError extends DomainUnprocessableError {
  readonly code = 'MECHANIC_TECHNICAL_CHANNELS_REQUIRED';

  constructor() {
    super('Las vacantes de personal mecánico requieren al menos un canal técnico especializado (SENATI o TECSUP - BR-REC-004).');
  }
}

export class CandidateNotFoundError extends DomainNotFoundError {
  readonly code = 'CANDIDATE_NOT_FOUND';

  constructor(id?: string) {
    super(id ? `Candidato ${id} no encontrado.` : 'Candidato no encontrado.');
  }
}

export class CandidateAlreadyDecidedError extends DomainConflictError {
  readonly code = 'CANDIDATE_ALREADY_DECIDED';

  constructor(decision: string) {
    super(`El candidato ya fue dictaminado como ${decision} y no admite nuevas decisiones (BR-REC-007, SDD 12.1).`);
  }
}

export class CandidateDocumentDuplicateError extends DomainConflictError {
  readonly code = 'CANDIDATE_DOCUMENT_DUPLICATE';

  constructor(documentNumber: string) {
    super(`Ya existe un postulante registrado con el documento ${documentNumber} para esta vacante.`);
  }
}

export class CandidateVersionConflictError extends DomainConflictError {
  readonly code = 'VERSION_CONFLICT';

  constructor() {
    super('El candidato fue modificado concurrentemente por otra operación. Recarga la ficha.');
  }
}

export class InterviewNotFoundError extends DomainNotFoundError {
  readonly code = 'INTERVIEW_NOT_FOUND';

  constructor(id?: string) {
    super(id ? `Entrevista ${id} no encontrada.` : 'Entrevista no encontrada.');
  }
}

export class OnboardingMissingNotarizedContractError extends DomainUnprocessableError {
  readonly code = 'ONBOARDING_NOTARIZED_CONTRACT_REQUIRED';

  constructor() {
    super('Para puestos mecánicos es mandatorio adjuntar y confirmar el contrato notariado (BR-REC-009).');
  }
}

export class CandidateNotContractedError extends DomainUnprocessableError {
  readonly code = 'CANDIDATE_NOT_CONTRACTED';

  constructor() {
    super('El candidato debe estar en estado CONTRATADO para poder iniciar e incorporar en onboarding.');
  }
}

export class ProbationAlreadyEvaluatedError extends DomainConflictError {
  readonly code = 'PROBATION_ALREADY_EVALUATED';

  constructor() {
    super('El periodo de prueba ya fue evaluado para este colaborador.');
  }
}

export class OnboardingNotFoundError extends DomainNotFoundError {
  readonly code = 'ONBOARDING_NOT_FOUND';

  constructor() {
    super('El proceso de incorporación no ha sido registrado para este candidato.');
  }
}

export class CandidateStageRegressionError extends DomainUnprocessableError {
  readonly code = 'CANDIDATE_STAGE_REGRESSION';

  constructor(currentStage: string, targetStage: string) {
    super(`No es posible retroceder la etapa del postulante de ${currentStage} a ${targetStage}.`);
  }
}

export class OnboardingChecklistIncompleteError extends DomainUnprocessableError {
  readonly code = 'ONBOARDING_CHECKLIST_INCOMPLETE';

  constructor() {
    super('Todos los ítems del checklist de incorporación deben completarse (inducción, equipo asignado y acta firmada).');
  }
}
