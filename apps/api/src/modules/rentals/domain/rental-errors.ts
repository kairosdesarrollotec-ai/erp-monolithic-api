import {
  DomainBadRequestError,
  DomainConflictError,
  DomainForbiddenError,
  DomainNotFoundError,
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

/**
 * BDD-ALQ-001.md 21.1 DT-ALQ-05 / SDD-DEV-001.md 12.1 - un cliente en
 * semaforo ROJO queda bloqueado para nuevas operaciones (BR-DEV-008: sin
 * rehabilitacion). El AMBAR ("cliente observado") NO bloquea: sigue siendo
 * cliente activo (Ficha AS-IS Alquiler, seccion 7).
 */
export class CustomerBlockedError extends DomainUnprocessableError {
  readonly code = 'CUSTOMER_BLOCKED';

  constructor() {
    super('El cliente esta en estado ROJO y no puede iniciar un nuevo alquiler.');
  }
}

export type VehicleNotAvailableReason = 'STATUS' | 'BRANCH' | 'COMMITMENT_OVERLAP';

/** SDD-KAIROS 12.6 - VEHICLE_NOT_AVAILABLE (409): solapamiento o vehiculo no disponible. */
export class VehicleNotAvailableForRentalError extends DomainConflictError {
  readonly code = 'VEHICLE_NOT_AVAILABLE';

  constructor(reason: VehicleNotAvailableReason, detail: string) {
    super(detail, { reason });
  }
}

/** El inquiryId indicado no existe en la empresa del contexto de trabajo. */
export class RentalInquiryNotFoundError extends DomainNotFoundError {
  readonly code = 'INQUIRY_NOT_FOUND';

  constructor() {
    super('La consulta indicada no existe en esta empresa.');
  }
}

/** DEC-ALQ-COMPANY-DRIVER-004: con conductor de la empresa no se exige ni cobra garantia. */
export class DepositNotApplicableWithCompanyDriverError extends DomainUnprocessableError {
  readonly code = 'DEPOSIT_NOT_APPLICABLE_WITH_COMPANY_DRIVER';

  constructor() {
    super(
      'Con conductor de la empresa no se exige ni se cobra garantia (la responsabilidad recae en el conductor). ' +
        'Omita depositAmount/depositCurrency.',
    );
  }
}

/** DEC-ALQ-OWN-DRIVER-005: persona NATURAL con conductor propio distinto del titular no esta permitido. */
export class NaturalPersonOwnDriverNotAllowedError extends DomainUnprocessableError {
  readonly code = 'NATURAL_PERSON_OWN_DRIVER_NOT_ALLOWED';

  constructor() {
    super(
      'Una persona natural no puede alquilar con conductor propio distinto del titular: conduce quien alquila ' +
        'o se solicita el conductor de la empresa. Solo la persona juridica puede autorizar un conductor propio (con adenda).',
    );
  }
}

/** DEC-ALQ-OWN-DRIVER-005: el tipo de titular (natural/juridica) no se pudo determinar. */
export class RentalHolderTypeRequiredError extends DomainUnprocessableError {
  readonly code = 'HOLDER_TYPE_REQUIRED';

  constructor() {
    super('Indique holderType (NATURAL o LEGAL): el alquiler aun no tiene contrato formalizado con tipo de titular.');
  }
}

export class RentalHolderTypeMismatchError extends DomainUnprocessableError {
  readonly code = 'HOLDER_TYPE_MISMATCH';

  constructor(contractHolderType: string) {
    super(`holderType no coincide con el del contrato formalizado (${contractHolderType}).`);
  }
}

/** DEC-ALQ-OWN-DRIVER-005: el conductor autorizado de persona juridica exige la adenda firmada. */
export class AuthorizedDriverAddendumRequiredError extends DomainBadRequestError {
  readonly code = 'ADDENDUM_DOCUMENT_REQUIRED';

  constructor() {
    super('El conductor autorizado de una persona juridica firma una adenda: indique addendumDocumentRef.');
  }
}

export class RentalDriverAlreadyRegisteredError extends DomainConflictError {
  readonly code = 'RENTAL_DRIVER_ALREADY_REGISTERED';

  constructor() {
    super('El cliente ya esta registrado como conductor autorizado de este alquiler.');
  }
}

/** El conductor autorizado solo se registra antes de la entrega (despues seria un conductor no aprobado: incidencia). */
export class RentalDriverRegistrationClosedError extends DomainConflictError {
  readonly code = 'RENTAL_DRIVER_REGISTRATION_CLOSED';

  constructor(status: string) {
    super(
      `No se puede registrar un conductor autorizado con el alquiler en estado ${status}. Si otra persona condujo sin ` +
        'autorizacion, registre una incidencia UNAUTHORIZED_DRIVER.',
    );
  }
}
