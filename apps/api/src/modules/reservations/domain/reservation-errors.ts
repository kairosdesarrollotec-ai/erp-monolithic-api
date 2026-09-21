import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ReservationStatus } from './reservation-status';

/** TDD-RES-001.md seccion 12/11.4 - REQUIREMENTS_INCOMPLETE (422). */
export class RequirementsIncompleteError extends UnprocessableEntityException {
  constructor(missing: string[]) {
    super({
      code: 'REQUIREMENTS_INCOMPLETE',
      detail: `Falta completar: ${missing.join(', ')}`,
      missingRequirements: missing,
    });
  }
}

/** TDD-RES-001.md seccion 11.4 - VEHICLE_NOT_AVAILABLE (409). */
export class VehicleNotAvailableError extends ConflictException {
  constructor() {
    super({
      code: 'VEHICLE_NOT_AVAILABLE',
      detail: 'El vehiculo ya no esta disponible para el intervalo solicitado.',
    });
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
export class ReservationVersionConflictError extends HttpException {
  constructor() {
    super(
      {
        code: 'RESERVATION_VERSION_CONFLICT',
        detail: 'La reserva fue modificada por otra operacion - vuelve a cargarla.',
        statusCode: HttpStatus.PRECONDITION_FAILED,
      },
      HttpStatus.PRECONDITION_FAILED,
    );
  }
}

/**
 * Hallazgo medio "If-Match no cumple semantica robusta": header ausente
 * es un precondition REQUIRED (RFC 6585), no un payload invalido - 428,
 * nunca 400.
 */
export class IfMatchRequiredError extends HttpException {
  constructor() {
    super(
      {
        code: 'IF_MATCH_REQUIRED',
        detail: 'Falta el header If-Match con la version vigente de la reserva.',
        statusCode: HttpStatus.PRECONDITION_REQUIRED,
      },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }
}

export class ReservationScopeForbiddenError extends ForbiddenException {
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
export class ReservationStateConflictError extends ConflictException {
  constructor(action: string, status: ReservationStatus) {
    super({
      code: 'RESERVATION_STATE_CONFLICT',
      detail: `No se puede ${action} una reserva en estado ${status}.`,
    });
  }
}
