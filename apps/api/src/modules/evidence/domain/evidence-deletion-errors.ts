import {
  DomainBadRequestError,
  DomainConflictError,
  DomainForbiddenError,
  DomainNotFoundError,
} from '../../../common/domain/domain-errors';

/** Formato del backend: `{ statusCode, code, detail }` (DomainExceptionFilter). */

export class EvidenceDeletionRequestNotFoundError extends DomainNotFoundError {
  readonly code = 'EVIDENCE_DELETION_REQUEST_NOT_FOUND';
  constructor(id: string) {
    super(`Solicitud de eliminacion de evidencia ${id} no encontrada.`);
  }
}

export class EvidenceDeletionReasonRequiredError extends DomainBadRequestError {
  readonly code = 'EVIDENCE_DELETION_REASON_REQUIRED';
  constructor(what = 'La solicitud de eliminacion de evidencia') {
    super(`${what} exige un motivo (minimo ${EVIDENCE_DELETION_MIN_REASON_LENGTH} caracteres).`);
  }
}

/** Ya hay una solicitud abierta (PENDING / APPROVED_1) sobre esa evidencia. */
export class EvidenceDeletionAlreadyRequestedError extends DomainConflictError {
  readonly code = 'EVIDENCE_DELETION_ALREADY_REQUESTED';
  constructor(requestId?: string) {
    super('Ya existe una solicitud de eliminacion abierta para esta evidencia.', requestId ? { requestId } : undefined);
  }
}

/** SDD 15.5: «solicitante y aprobador deben ser personas distintas». */
export class EvidenceDeletionSelfApprovalError extends DomainForbiddenError {
  readonly code = 'EVIDENCE_DELETION_SELF_APPROVAL';
  constructor(action: 'approve' | 'reject' = 'approve') {
    super(
      action === 'approve'
        ? 'Quien solicita la eliminacion no puede aprobarla: la aprueban dos personas distintas del solicitante.'
        : 'Quien solicita la eliminacion no puede rechazarla.',
    );
  }
}

/** La segunda aprobacion debe venir de una persona distinta de la primera. */
export class EvidenceDeletionSameApproverError extends DomainForbiddenError {
  readonly code = 'EVIDENCE_DELETION_SAME_APPROVER';
  constructor() {
    super('La segunda aprobacion debe darla una persona distinta de quien dio la primera.');
  }
}

/** La solicitud ya no esta abierta (ejecutada, rechazada, vencida) o cambio de estado mientras se resolvia. */
export class EvidenceDeletionInvalidStateError extends DomainConflictError {
  readonly code = 'EVIDENCE_DELETION_INVALID_STATE';
  constructor(status: string) {
    super(`La solicitud esta en estado ${status} y no admite esta accion.`, { status });
  }
}

export class EvidenceDeletionRequestExpiredError extends DomainConflictError {
  readonly code = 'EVIDENCE_DELETION_REQUEST_EXPIRED';
  constructor() {
    super('La solicitud de eliminacion vencio sin completarse la doble aprobacion; abra una solicitud nueva.');
  }
}

export const EVIDENCE_DELETION_MIN_REASON_LENGTH = 5;
export const EVIDENCE_DELETION_MAX_REASON_LENGTH = 500;
