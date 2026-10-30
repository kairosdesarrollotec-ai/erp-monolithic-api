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

export class ContractVariantDriverConflictError extends DomainBadRequestError {
  readonly code = 'CONTRACT_VARIANT_DRIVER_CONFLICT';

  constructor() {
    super(
      'withCompanyDriver (servicio de conductor ofrecido por la empresa) y el alias deprecado withDriver ' +
        'se enviaron con valores distintos. Envie solo withCompanyDriver; no lo confunda con el conductor ' +
        'distinto del titular (BR-ALQ-015).',
    );
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

/** Decisión de negocio 28-oct #6 (H-21): el resultado del alcolímetro es obligatorio antes de entregar el vehículo. */
export class AlcoholTestRequiredError extends DomainUnprocessableError {
  readonly code = 'ALCOHOL_TEST_REQUIRED';

  constructor() {
    super('El resultado del alcolímetro es obligatorio antes de entregar el vehículo. Regístralo en la etapa de validaciones.');
  }
}

/** Decisión de negocio 28-oct #8 (H-24): todo alquiler debe tener fecha de devolución prevista al entregarse. */
export class ExpectedEndDateRequiredError extends DomainUnprocessableError {
  readonly code = 'EXPECTED_END_DATE_REQUIRED';

  constructor() {
    super('El alquiler necesita una fecha de devolución prevista antes de entregar el vehículo.');
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

export class ExtensionBlockedByBreachError extends DomainUnprocessableError {
  readonly code = 'EXTENSION_BLOCKED_BY_BREACH';

  constructor() {
    super('El alquiler tiene una falta grave registrada (BR-ALQ-013): el cliente esta en ROJO y no se le puede aprobar otra ampliacion. Solo corresponde la devolucion.');
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

  /** V-25: el mensaje nombra la operación bloqueada (alquiler por defecto; reserva al reservar/confirmar). */
  constructor(operation: 'alquiler' | 'reserva' = 'alquiler') {
    super(`El cliente esta en estado ROJO y no puede iniciar un nuevo ${operation}.`);
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

/** BDD ALQ-P03 / Ficha AS-IS (excepcion de conductor): el acompanante autorizado es una excepcion de persona NATURAL. */
export class CompanionNotApplicableForLegalHolderError extends DomainUnprocessableError {
  readonly code = 'COMPANION_NOT_APPLICABLE_FOR_LEGAL_HOLDER';

  constructor() {
    super(
      'El acompanante autorizado aplica a persona natural. En persona juridica el conductor propio se registra ' +
        'como conductor autorizado con su adenda (register-authorized-driver).',
    );
  }
}

export class CompanionReasonRequiredError extends DomainBadRequestError {
  readonly code = 'COMPANION_REASON_REQUIRED';

  constructor() {
    super('Indique el motivo por el que el titular no puede firmar (p. ej. licencia no vigente en Peru).');
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

/** Respuesta de Fiorella 16-oct-2026: la licencia no se guarda, solo se exige el check "licencia vigente verificada". */
export class LicenseVerificationRequiredError extends DomainUnprocessableError {
  readonly code = 'LICENSE_VERIFICATION_REQUIRED';

  constructor(who: 'COMPANION' | 'DRIVER') {
    super(
      who === 'COMPANION'
        ? 'Confirme que verifico la licencia vigente del acompanante (companionLicenseVerified).'
        : 'Confirme que verifico la licencia vigente del conductor real (driverLicenseVerified).',
    );
  }
}

/** Con acompanante firmante hay que registrar tambien al conductor real (parte DRIVER). */
export class CompanionDriverMustDifferError extends DomainUnprocessableError {
  readonly code = 'COMPANION_DRIVER_MUST_DIFFER';

  constructor() {
    super('El acompanante firma como responsable y no conduce: indique como conductor real a otra persona.');
  }
}

/** Maximo de acompanantes = capacidad de pasajeros del vehiculo (campo de Flota). */
export class CompanionPassengerCapacityExceededError extends DomainUnprocessableError {
  readonly code = 'COMPANION_PASSENGER_CAPACITY_EXCEEDED';

  constructor(capacity: number) {
    super(`El vehiculo admite como maximo ${capacity} acompanante(s) (capacidad de pasajeros).`);
  }
}

/** DEC-ALQ-DRIVERRATE-001: la tarifa diaria solo aplica a alquileres con contrato de conductor de la empresa. */
export class CompanyDriverRateNotApplicableError extends DomainUnprocessableError {
  readonly code = 'COMPANY_DRIVER_RATE_NOT_APPLICABLE';

  constructor() {
    super(
      'La tarifa diaria del conductor de la empresa solo se puede digitar en un alquiler con conductor de la empresa ' +
        '(contrato formalizado con esa variante).',
    );
  }
}

/** ENTREGA-02 (Respuestas 2026-10-20 #10): alcolimetro desfavorable/rechazado = check "no cumple rango" + foto obligatoria. */
export class AlcoholTestPhotoRequiredError extends DomainUnprocessableError {
  readonly code = 'ALCOHOL_TEST_PHOTO_REQUIRED';

  constructor() {
    super(
      'Un alcolimetro desfavorable o rechazado exige la foto de la prueba como evidencia (zona ALCOHOL_TEST). Subala antes de registrar el resultado.',
    );
  }
}

/** DEC-ALQ-DRIVERRATE-002 (Respuestas 2026-10-20 #2): sin tarifa digitada no termina el proceso de alquiler. */
export class CompanyDriverRateRequiredError extends DomainUnprocessableError {
  readonly code = 'COMPANY_DRIVER_RATE_REQUIRED';

  constructor() {
    super(
      'Falta la tarifa diaria del conductor de la empresa. Digitela (set-company-driver-daily-rate) antes de completar la entrega.',
    );
  }
}

/** DEC-ALQ-DRIVERRATE-001/002: la tarifa diaria solo se edita hasta completar la entrega (fin del proceso de alquiler). */
export class CompanyDriverRateClosedError extends DomainConflictError {
  readonly code = 'COMPANY_DRIVER_RATE_CLOSED';

  constructor(status: string) {
    super(`No se puede digitar la tarifa diaria del conductor de la empresa con el alquiler en estado ${status}.`);
  }
}

/** DEC-ALQ-DRIVERRATE-001: monto > 0 con maximo 2 decimales. */
export class CompanyDriverRateInvalidError extends DomainBadRequestError {
  readonly code = 'COMPANY_DRIVER_RATE_INVALID';

  constructor() {
    super('La tarifa diaria debe ser un monto mayor que 0 con un maximo de 2 decimales (hasta 99999999.99).');
  }
}

/** Russbel 22-oct-2026 (decision 1; BR-CON-003, EX-CON-001): Consulta es el unico punto de entrada; `POST /rentals` exige `inquiryId`. */
export class RentalInquiryRequiredError extends DomainUnprocessableError {
  readonly code = 'INQUIRY_REQUIRED';

  constructor() {
    super(
      'Un alquiler nace siempre de una Consulta (BR-CON-003): registra y cotiza la consulta y usa ' +
        'POST /inquiries/{id}/commands/convert-to-rental, o parte de una reserva con POST /rentals/from-reservation/{id}.',
    );
  }
}

/** `POST /rentals`: el vehiculo debe ser el de la cotizacion vigente de la consulta (como en convert-to-rental). */
export class RentalInquiryVehicleMismatchError extends DomainUnprocessableError {
  readonly code = 'INQUIRY_VEHICLE_MISMATCH';

  constructor() {
    super('El vehículo indicado no es el de la cotización vigente de la consulta.');
  }
}

/** El `customerId` enviado no es el cliente de la consulta indicada. */
export class RentalInquiryCustomerMismatchError extends DomainUnprocessableError {
  readonly code = 'INQUIRY_CUSTOMER_MISMATCH';

  constructor() {
    super('El cliente indicado no coincide con el cliente de la consulta.');
  }
}

/** Russbel 22-oct-2026 (decision 3): Reserva -> Alquiler solo desde el dia pactado (hora de Lima). Antes del dia: 422. */
export class ReservationStartNotReachedError extends DomainUnprocessableError {
  readonly code = 'RESERVATION_START_NOT_REACHED';

  constructor(startDate: string) {
    super(`La reserva es para el ${startDate} (hora de Lima): el alquiler solo puede iniciarse desde ese dia.`, { startDate });
  }
}

/** Russbel 22-oct-2026 (decision 3): pasado el dia pactado aplica el protocolo de no-show por Gerencia; no se inicia alquiler. */
export class ReservationStartDatePassedError extends DomainUnprocessableError {
  readonly code = 'RESERVATION_START_DATE_PASSED';

  constructor(startDate: string) {
    super(
      `La fecha pactada de la reserva (${startDate}, hora de Lima) ya paso: aplica el protocolo de no-show por Gerencia (cancelar por no-show); no se puede iniciar el alquiler.`,
      { startDate },
    );
  }
}

/** Decision 8 (22-oct-2026): garantia insuficiente respecto a la tarifa de Flota (x2 si DOUBLE_DEPOSIT) o monto no valido. */
export class GuaranteeBelowRequiredError extends DomainUnprocessableError {
  readonly code = 'INVALID_DEPOSIT_AMOUNT';

  constructor(submitted: string, required: string, multiplier: number) {
    super(
      `La garantia (${submitted}) es menor que la exigida por la tarifa de Flota (${required}${multiplier === 2 ? ', doble garantia' : ''}).`,
      { submittedAmount: submitted, requiredAmount: required, multiplier },
    );
  }
}

/** Decision 8: el cobro de la garantia exige comprobante (medio, nº de operacion/recibo, pagador, comprobante subido). */
export class GuaranteePaymentProofRequiredError extends DomainUnprocessableError {
  readonly code = 'PAYMENT_PROOF_REQUIRED';

  constructor(missing: string[]) {
    super(`Falta el comprobante del cobro de la garantia: ${missing.join(', ')}.`, { missing });
  }
}

/** BR-ALQ-011: pagos hechos por un agente externo requieren verificacion adicional. */
export class ExternalAgentVerificationRequiredError extends DomainUnprocessableError {
  readonly code = 'EXTERNAL_AGENT_VERIFICATION_REQUIRED';

  constructor() {
    super(
      'El pago lo realiza un agente externo (BR-ALQ-011): indique el documento del pagador y confirme la verificacion adicional (externalAgentVerified=true).',
    );
  }
}

export class GuaranteeVoucherNotFoundError extends DomainUnprocessableError {
  readonly code = 'PAYMENT_VOUCHER_NOT_FOUND';

  constructor() {
    super('El comprobante indicado no existe entre los documentos de este alquiler (suba primero un documento PAYMENT_VOUCHER).');
  }
}

/** BR-CON-004: documentos requeridos segun nacionalidad no validados. Incluye el set requerido y los faltantes. */
export class RentalDocumentsIncompleteError extends DomainUnprocessableError {
  readonly code = 'DOCUMENTS_INCOMPLETE';

  constructor(missing: string[], required: string[]) {
    super(`Falta validar los siguientes documentos requeridos (BR-CON-004): ${missing.join(', ')}`, {
      missingDocuments: missing,
      requiredDocuments: required,
    });
  }
}

/** Decision 2 (22-oct-2026): el credito de reserva nunca supera la garantia (sin saldo a favor); defensa en formalizar contrato. */
export class ReservationCreditExceedsGuaranteeError extends DomainUnprocessableError {
  readonly code = 'RESERVATION_EXCEEDS_GUARANTEE';

  constructor(reservationAmount: string, guarantee: string) {
    super(
      `El monto de la reserva (${reservationAmount}) no puede superar la garantia del alquiler (${guarantee}); no hay saldo a favor.`,
      { reservationAmount, guarantee },
    );
  }
}

/** DEC-ALQ-CANCEL-001: la cancelacion exige un motivo valido. */
export class RentalCancelReasonInvalidError extends DomainBadRequestError {
  readonly code = 'INVALID_CANCEL_REASON';

  constructor(allowed: readonly string[]) {
    super(`Motivo de cancelacion no valido. Use ${allowed.join(', ')} (OTHER exige una nota de al menos 10 caracteres).`);
  }
}

export class NotaryEvaluationRequiredError extends DomainUnprocessableError {
  readonly code = 'NOTARY_EVALUATION_REQUIRED';

  constructor() {
    super('Primero se debe evaluar la notaria (evaluate-notary): no hay evaluacion notarial que aprobar.');
  }
}

export class NotaryExceptionNotApplicableError extends DomainUnprocessableError {
  readonly code = 'NOTARY_EXCEPTION_NOT_APPLICABLE';

  constructor(result: string) {
    super(`La evaluacion notarial dio ${result}: solo THIRD_PATH_ELIGIBLE o MANUAL_REVIEW admiten aprobacion de excepcion por Gerencia.`);
  }
}

/** BR-ALQ-002, HU-28, SC-ALQ-001: el trámite notarial lo asume la empresa y está prohibido clasificarlo como pago del cliente. */
export class NotaryExpenseCannotBeCustomerPaymentError extends DomainUnprocessableError {
  readonly code = 'NOTARY_EXPENSE_CANNOT_BE_CUSTOMER_PAYMENT';

  constructor() {
    super('El trámite notarial lo asume la empresa y está prohibido clasificarlo como pago del cliente (BR-ALQ-002, HU-28, SC-ALQ-001).');
  }
}


/** A-01 (29-oct-2026): evaluar notaria exige la verificacion biometrica favorable marcada por el personal. */
export class BiometricVerificationRequiredError extends DomainUnprocessableError {
  readonly code = 'BIOMETRIC_VERIFICATION_REQUIRED';

  constructor() {
    super('Marca la verificacion biometrica favorable antes de evaluar la notaria.');
  }
}

/** A-02 (29-oct-2026): ENTREGA-02 no continua sin confirmar manualmente RENIEC y MTC. */
export class IdentityVerificationRequiredError extends DomainUnprocessableError {
  readonly code = 'IDENTITY_VERIFICATION_REQUIRED';

  constructor(missing: string[]) {
    super(
      `Confirma manualmente la verificacion de ${missing.join(' y ')} antes de continuar. ` +
        'Solo Gerencia puede exceptuar RENIEC (con motivo); MTC no admite excepcion.',
    );
  }
}
