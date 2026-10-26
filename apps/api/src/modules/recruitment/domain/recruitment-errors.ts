import {
  DomainConflictError,
  DomainForbiddenError,
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
    super('Las vacantes de personal mecánico requieren al menos un canal técnico especializado (SENATI, TECSUP o Institutos técnicos - BR-REC-004).');
  }
}

/** REC-02 cancelar (22-oct): solo NECESIDAD_REGISTRADA / PUBLICADA / PAUSADA; con candidatos en proceso o decidida/cancelada ya no. */
export class VacancyNotCancellableError extends DomainUnprocessableError {
  readonly code = 'VACANCY_NOT_CANCELLABLE';

  constructor(currentStatus: string) {
    super(
      `La vacante no se puede cancelar en estado ${currentStatus}: solo aplica a vacantes con necesidad registrada, publicadas o pausadas.`,
    );
  }
}

export class VacancyCancelReasonRequiredError extends DomainUnprocessableError {
  readonly code = 'VACANCY_CANCEL_REASON_REQUIRED';

  constructor() {
    super('Indica el motivo de la cancelación de la vacante (entre 5 y 500 caracteres).');
  }
}

/** 22-oct: el area de la vacante debe existir (y estar activa) en el catalogo hr_areas de la empresa. */
export class VacancyAreaNotFoundError extends DomainUnprocessableError {
  readonly code = 'VACANCY_AREA_NOT_FOUND';

  constructor(area: string) {
    super(`El área «${area}» no existe o está inactiva en el catálogo de áreas de la empresa. Elige un área del catálogo (Personal > Áreas).`);
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

export class VacancyNotPausableError extends DomainUnprocessableError {
  readonly code = 'VACANCY_NOT_PAUSABLE';

  constructor(currentStatus: string, action: 'pausar' | 'reanudar') {
    super(
      action === 'pausar'
        ? `Solo se puede pausar una vacante publicada (estado actual: ${currentStatus}).`
        : `Solo se puede reanudar una vacante pausada (estado actual: ${currentStatus}).`,
    );
  }
}

export class CandidateCvInvalidFileError extends DomainUnprocessableError {
  readonly code = 'CANDIDATE_CV_INVALID_FILE';

  constructor(detail: string) {
    super(detail);
  }
}

export class CandidateCvObjectMismatchError extends DomainUnprocessableError {
  readonly code = 'CANDIDATE_CV_OBJECT_MISMATCH';

  constructor() {
    super('El archivo indicado no corresponde a una subida autorizada para este candidato. Vuelve a subir el CV.');
  }
}

export class CandidateCvNotUploadedError extends DomainUnprocessableError {
  readonly code = 'CANDIDATE_CV_NOT_UPLOADED';

  constructor() {
    super('No encontramos el archivo en el almacenamiento. Vuelve a subir el CV.');
  }
}

export class CandidateCvNotFoundError extends DomainNotFoundError {
  readonly code = 'CANDIDATE_CV_NOT_FOUND';

  constructor() {
    super('Este candidato todavía no tiene un CV cargado.');
  }
}

export class NegotiationInvalidError extends DomainUnprocessableError {
  readonly code = 'NEGOTIATION_INVALID';

  constructor(detail: string) {
    super(detail);
  }
}

export class ProbationFeesRestrictedError extends DomainForbiddenError {
  readonly code = 'ROLE_NOT_ALLOWED';

  constructor() {
    super('Registrar honorarios requiere permiso para ver datos sensibles del candidato.');
  }
}

export class OnboardingVersionConflictError extends DomainConflictError {
  readonly code = 'VERSION_CONFLICT';

  constructor() {
    super('La incorporación fue modificada por otra operación. Recarga los datos.');
  }
}

export class CandidateStateTransitionError extends DomainUnprocessableError {
  readonly code = 'CANDIDATE_STATE_TRANSITION_INVALID';

  constructor(currentState: string, targetState: string) {
    super(
      `No es posible pasar al candidato de ${currentState} a ${targetState} en el flujo de Reclutamiento y Selección (BDD-REC §11.6).`,
    );
  }
}

/** Respuestas 2026-10-20 #16: la incorporacion ya se completo (el candidato ya esta INGRESADO / PERIODO_PRUEBA / PLANILLA / TERMINADO). */
export class OnboardingAlreadyCompletedError extends DomainConflictError {
  readonly code = 'ONBOARDING_ALREADY_COMPLETED';

  constructor(currentState: string) {
    super(`La incorporación de este candidato ya se completó (estado actual: ${currentState}).`);
  }
}

/** Respuestas 2026-10-20 #14: rechazar a un candidato ya entrevistado (Descartado) exige el motivo. */
export class DecisionReasonRequiredError extends DomainUnprocessableError {
  readonly code = 'DECISION_REASON_REQUIRED';

  constructor() {
    super('Indica el motivo: el rechazo de un candidato ya entrevistado (Descartado) exige decisionNotes.');
  }
}

/** Respuestas 2026-10-20 #12/#13: la accion la decide solo Gerencia General (permiso especifico). */
export class GerenciaDecisionRequiredError extends DomainForbiddenError {
  readonly code = 'ROLE_NOT_ALLOWED';

  constructor(what: string) {
    super(`${what} lo decide solo Gerencia General.`);
  }
}

/** DEC-REC-REQUIREMENTS-001 (23-oct-2026): CV y pretensión salarial son obligatorios antes de registrar el resultado de la entrevista. */
export class CandidateRequirementsIncompleteError extends DomainUnprocessableError {
  readonly code = 'CANDIDATE_REQUIREMENTS_INCOMPLETE';

  constructor(detail?: string) {
    super(
      detail ??
        'El candidato debe contar con CV adjunto y pretensión salarial registrada antes de registrar el resultado de la entrevista.',
    );
  }
}

