import {
  DomainBadRequestError,
  DomainConflictError,
  DomainForbiddenError,
  DomainPreconditionError,
  DomainPreconditionRequiredError,
  DomainUnprocessableError,
} from '../../../common/domain/domain-errors';
import { formatLimaDMY } from '../../../common/time/lima-time';
import { ReservationStatus } from './reservation-status';

export class InvalidReservationCancelReasonError extends DomainBadRequestError {
  readonly code = 'INVALID_CANCEL_REASON';

  constructor(allowedReasons: readonly string[]) {
    super(
      `Motivo de cancelacion no permitido. Use ${allowedReasons.join(' o ')}; ` +
        'la venta del vehiculo se resuelve con resolve-sale.',
    );
  }
}

/** TDD-RES-001.md seccion 12/11.4 - REQUIREMENTS_INCOMPLETE (422). */
export class RequirementsIncompleteError extends DomainUnprocessableError {
  readonly code = 'REQUIREMENTS_INCOMPLETE';

  constructor(missing: string[]) {
    super(`Falta completar: ${missing.join(', ')}`, { missingRequirements: missing });
  }
}

function dmy(date: Date): string {
  return formatLimaDMY(date);
}

/**
 * Regla de negocio (Fiorella, 16-oct-2026): "la reserva nunca superara la garantia".
 * Validacion defensiva: el monto de la reserva no puede exceder la garantia del vehiculo
 * (`Vehicle.depositMinimum`, Flota). RESERVATION_EXCEEDS_GUARANTEE (422).
 */
export class ReservationExceedsGuaranteeError extends DomainUnprocessableError {
  readonly code = 'RESERVATION_EXCEEDS_GUARANTEE';

  constructor(amount: string, guarantee: string) {
    super(`El monto de la reserva (${amount}) no puede superar la garantía del vehículo (${guarantee}).`);
  }
}

/** TDD-RES-001.md seccion 11.4 - VEHICLE_NOT_AVAILABLE (409). */
export class VehicleNotAvailableError extends DomainConflictError {
  readonly code = 'VEHICLE_NOT_AVAILABLE';

  constructor(conflict?: { from: Date; to: Date }) {
    super(
      conflict
        ? `El vehículo ya no está disponible para el intervalo solicitado: está ocupado del ${dmy(conflict.from)} al ${dmy(conflict.to)}.`
        : 'El vehículo ya no está disponible para el intervalo solicitado.',
    );
  }
}

/**
 * Hallazgo medio de revision PR#6 ("If-Match no cumple semantica
 * robusta"): un conflicto real de version optimista es un precondition
 * failure sobre el recurso (RFC 9110 13.1.2), no un conflicto de estado
 * de negocio - se cambia de 409 a 412 Precondition Failed, que es lo que
 * la propia documentacion original del TDD ya indicaba (comentario
 * previo: "aqui como 409 por simplicidad HTTP", ahora corregido).
 */
export class ReservationVersionConflictError extends DomainPreconditionError {
  readonly code = 'RESERVATION_VERSION_CONFLICT';

  constructor() {
    super('La reserva fue modificada por otra operacion - vuelve a cargarla.');
  }
}

/**
 * Hallazgo medio "If-Match no cumple semantica robusta": header ausente
 * es un precondition REQUIRED (RFC 6585), no un payload invalido - 428,
 * nunca 400.
 */
export class IfMatchRequiredError extends DomainPreconditionRequiredError {
  readonly code = 'IF_MATCH_REQUIRED';

  constructor() {
    super('Falta el header If-Match con la version vigente de la reserva.');
  }
}

export class ReservationScopeForbiddenError extends DomainForbiddenError {
  readonly code = 'RESERVATION_SCOPE_FORBIDDEN';

  constructor() {
    super('La reserva no pertenece al contexto de trabajo del usuario.');
  }
}

/**
 * Hallazgo alto de revision PR#6 ("maquina de estados incompleta"): se
 * intento una operacion no valida para el estado actual de la reserva
 * (p.ej. registrar pago sobre una reserva CANCELLED, o cancelar una ya
 * CONVERTED). 409 porque es un conflicto entre el estado actual del
 * recurso y la operacion pedida - distinto del 412 de version, que es
 * sobre el valor de If-Match, no sobre el estado de negocio.
 */
export class ReservationStateConflictError extends DomainConflictError {
  readonly code = 'RESERVATION_STATE_CONFLICT';

  constructor(action: string, status: ReservationStatus) {
    super(`No se puede ${action} una reserva en estado ${status}.`);
  }
}

/**
 * Hallazgo CRITICO de revalidacion PR#7 ("cardinalidad Inquiry ->
 * Reservation no garantizada"): la base rechaza (UNIQUE
 * reservations.inquiry_id) una segunda reserva para la misma consulta -
 * p.ej. dos conversiones concurrentes. Se traduce a 409 con codigo propio
 * en vez de un 500 generico.
 */
export class InquiryAlreadyHasReservationError extends DomainConflictError {
  readonly code = 'INQUIRY_ALREADY_CONVERTED';

  constructor() {
    super('La consulta ya tiene una reserva asociada - una consulta se convierte a lo sumo una vez.');
  }
}

/**
 * Hallazgo CRITICO de revalidacion PR#7 - caso de uso unico: una Reserva
 * solo se crea desde una Consulta COTIZADA via
 * `POST /inquiries/{id}/commands/convert-to-reservation`, que transiciona
 * la Consulta a CONVERTIDA en la misma transaccion. `POST /reservations`
 * permitia crear una reserva citando una consulta en cualquier estado
 * (incluso cerrada) sin transicionarla - ver docs/conflicts/CONFLICT-CON-001.md.
 */
export class InquiryConversionRequiredError extends DomainConflictError {
  readonly code = 'INQUIRY_CONVERSION_REQUIRED';

  constructor(inquiryId: string) {
    super(`Las reservas se crean convirtiendo la consulta: POST /inquiries/${inquiryId}/commands/convert-to-reservation.`);
  }
}

/**
 * DEC-CON-001-FINAL + Russbel 22-oct-2026 (decision 1): Consulta es el unico punto de entrada. `POST /reservations`
 * sin `inquiryId` ya no crea nada: 422 INQUIRY_REQUIRED (BR-CON-003, EX-CON-001).
 */
export class InquiryRequiredError extends DomainUnprocessableError {
  readonly code = 'INQUIRY_REQUIRED';

  constructor() {
    super(
      'Una reserva nace siempre de una Consulta (BR-CON-003): registra y cotiza la consulta y conviertela con ' +
        'POST /inquiries/{id}/commands/convert-to-reservation.',
    );
  }
}

/** Decision 8 (22-oct-2026): el monto pagado no alcanza (o excede) el monto que la politica vigente exige para la reserva. */
export class InvalidDepositAmountError extends DomainUnprocessableError {
  readonly code = 'INVALID_DEPOSIT_AMOUNT';

  constructor(paid: string, required: string, reason: 'BELOW_REQUIRED' | 'ABOVE_REQUIRED') {
    super(
      reason === 'BELOW_REQUIRED'
        ? `El monto pagado (${paid}) es menor que el monto de reserva exigido por la politica vigente (${required}).`
        : `El monto pagado (${paid}) supera el monto de reserva exigido (${required}); la reserva se cobra por el monto exacto y no genera saldo a favor.`,
      { paidAmount: paid, requiredAmount: required },
    );
  }
}

/** Decision 8 (propuesta): todo pago exige comprobante; en EFECTIVO basta el nº de recibo o el comprobante. */
export class PaymentProofRequiredError extends DomainUnprocessableError {
  readonly code = 'PAYMENT_PROOF_REQUIRED';

  constructor(missing: string[]) {
    super(`Falta el comprobante del pago: ${missing.join(', ')}.`, { missing });
  }
}

/** El `voucherDocumentId` indicado no es un comprobante (PAYMENT_VOUCHER) subido a esta reserva. */
export class PaymentVoucherNotFoundError extends DomainUnprocessableError {
  readonly code = 'PAYMENT_VOUCHER_NOT_FOUND';

  constructor() {
    super('El comprobante indicado no existe entre los documentos de esta reserva (suba primero un documento PAYMENT_VOUCHER).');
  }
}

/** register-documents exige documentos realmente subidos (distintos del comprobante de pago). */
export class DocumentsNotUploadedError extends DomainUnprocessableError {
  readonly code = 'DOCUMENTS_NOT_UPLOADED';

  constructor() {
    super('No hay documentos del cliente subidos a la reserva: suba al menos un documento (ID_DOCUMENT u OTHER) antes de marcarlos como completos.');
  }
}

export class InvalidReservationPeriodError extends DomainBadRequestError {
  readonly code = 'INVALID_PERIOD';

  constructor() {
    super('La fecha de inicio de la reserva debe ser anterior a la fecha de fin.');
  }
}

/**
 * RES PEND-08 / BR-RES-005 / SC-RES-007 (modalidad por ubicacion): una reserva PRESENCIAL exige un cliente que se pueda
 * acercar a la oficina (en Ayacucho). Si el cliente esta fuera o no puede acercarse, la modalidad debe ser VIRTUAL.
 */
export class ChannelModeMismatchError extends DomainUnprocessableError {
  readonly code = 'CHANNEL_MODE_MISMATCH';

  constructor() {
    super(
      'Una reserva PRESENCIAL requiere que el cliente se encuentre en Ayacucho y pueda acercarse a la oficina; ' +
        'si esta fuera o no puede acercarse, la modalidad es VIRTUAL.',
    );
  }
}

/**
 * BR-RES-005, BR-RES-006, SC-RES-003, SC-RES-004: En modalidad remota, confirmar la reserva
 * exige que se hayan completado los requisitos remotos: video 360 del vehículo y documento de aceptación firmado.
 * 422 RESERVATION_REQUIREMENTS_NOT_MET.
 */
export class ReservationRequirementsNotMetError extends DomainUnprocessableError {
  readonly code = 'RESERVATION_REQUIREMENTS_NOT_MET';
  readonly missingRequirements: string[];

  constructor(missing: string[]) {
    super(`Requisitos remotos incompletos para confirmar la reserva: ${missing.join(', ')}.`, {
      missingRequirements: missing,
    });
    this.missingRequirements = missing;
  }
}

