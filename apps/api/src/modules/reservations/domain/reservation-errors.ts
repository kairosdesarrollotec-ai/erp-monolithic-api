import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';

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

/** TDD-RES-001.md seccion 10.4 - RESERVATION_VERSION_CONFLICT (412), aqui como 409 por simplicidad HTTP del stack actual. */
export class ReservationVersionConflictError extends ConflictException {
  constructor() {
    super({
      code: 'RESERVATION_VERSION_CONFLICT',
      detail: 'La reserva fue modificada por otra operacion - vuelve a cargarla.',
    });
  }
}

export class ReservationScopeForbiddenError extends ForbiddenException {
  constructor() {
    super('La reserva no pertenece al contexto de trabajo del usuario.');
  }
}
