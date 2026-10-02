import {
  DomainConflictError,
  DomainForbiddenError,
  DomainPreconditionError,
  DomainUnprocessableError,
} from '../../../common/domain/domain-errors';
import { RentalStatus } from './rental-status';

export class RentalVersionConflictError extends DomainPreconditionError {
  readonly code = 'RENTAL_VERSION_CONFLICT';

  constructor() {
    super('El alquiler fue modificado por otra operacion - vuelve a cargarlo.');
  }
}

export class RentalStateConflictError extends DomainConflictError {
  readonly code = 'RENTAL_STATE_CONFLICT';

  constructor(action: string, status: RentalStatus) {
    super(`No se puede ${action} un alquiler en estado ${status}.`);
  }
}

export class InvalidRentalStateTransitionError extends DomainConflictError {
  readonly code = 'INVALID_RENTAL_STATE_TRANSITION';

  constructor(from: RentalStatus, to: RentalStatus) {
    super(`Transicion no permitida de ${from} a ${to}.`);
  }
}

export class RentalScopeForbiddenError extends DomainForbiddenError {
  readonly code = 'RENTAL_SCOPE_FORBIDDEN';

  constructor() {
    super('El alquiler no pertenece al contexto de trabajo del usuario.');
  }
}

export class AlcoholTestUnfavorableError extends DomainUnprocessableError {
  readonly code = 'ALCOHOL_TEST_UNFAVORABLE';

  constructor(result: string) {
    super(`Prueba de alcolimetro no superada (${result}). La entrega queda cancelada por tolerancia cero (BR-ALQ-005).`);
  }
}

export class NotaryExceptionRequiresApprovalError extends DomainForbiddenError {
  readonly code = 'NOTARY_EXCEPTION_REQUIRES_APPROVAL';

  constructor() {
    super('La excepcion notarial requiere aprobacion gerencial explicita (BR-ALQ-004).');
  }
}

export class MissingDeliveryEvidenceError extends DomainUnprocessableError {
  readonly code = 'MISSING_REQUIRED_EVIDENCE';

  constructor(missingDetails: string[]) {
    super(
      `No se puede completar la entrega: falta completar la evidencia obligatoria (${missingDetails.join(', ')}).`,
      {
        violations: missingDetails.map((item) => ({
          field: 'evidence',
          rule: 'BR-INS-003/004',
          missing: item,
        })),
      },
    );
  }
}

export class ProhibitedVehicleNotaryExemptionError extends DomainUnprocessableError {
  readonly code = 'PROHIBITED_VEHICLE_NOTARY_EXEMPTION';

  constructor(model: string) {
    super(`El vehiculo modelo ${model} tiene prohibicion absoluta de excepcion notarial (BR-ALQ-003). Requiere tramite notarial MANDATORY.`);
  }
}

export class ExtensionAdvanceNoticeError extends DomainUnprocessableError {
  readonly code = 'EXTENSION_ADVANCE_NOTICE_REQUIRED';

  constructor() {
    super('La ampliacion debe solicitarse con al menos 12 horas de anticipacion al vencimiento actual del alquiler (BR-ALQ-012).');
  }
}

export class ExtensionMaxDurationError extends DomainUnprocessableError {
  readonly code = 'EXTENSION_MAX_DURATION_EXCEEDED';

  constructor() {
    super('La ampliacion no puede exceder 3 dias consecutivos (1 dia si es por horas) sin firmar un nuevo contrato (BR-ALQ-012).');
  }
}

export class ExtensionNotPendingError extends DomainConflictError {
  readonly code = 'EXTENSION_NOT_PENDING';

  constructor(status: string) {
    super(`No se puede resolver la ampliacion: se encuentra en estado ${status}, no PENDING.`);
  }
}

export class VehicleUnavailableForExtensionError extends DomainUnprocessableError {
  readonly code = 'VEHICLE_UNAVAILABLE_FOR_EXTENSION';

  constructor() {
    super('El vehiculo tiene otro compromiso (reserva o alquiler) que impide autorizar la ampliacion.');
  }
}
