import {
  DomainConflictError,
  DomainForbiddenError,
  DomainPreconditionError,
  DomainPreconditionRequiredError,
  DomainUnprocessableError,
} from '../../../common/domain/domain-errors';
import { ReservationStatus } from './reservation-status';

/** TDD-RES-001.md seccion 12/11.4 - REQUIREMENTS_INCOMPLETE (422). */
export class RequirementsIncompleteError extends DomainUnprocessableError {
  readonly code = 'REQUIREMENTS_INCOMPLETE';

  constructor(missing: string[]) {
    super(`Falta completar: ${missing.join(', ')}`, { missingRequirements: missing });
  }
}

function dmy(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
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
