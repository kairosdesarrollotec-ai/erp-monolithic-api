import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RentalStatus } from './rental-status';

export class RentalVersionConflictError extends HttpException {
  constructor() {
    super(
      {
        code: 'RENTAL_VERSION_CONFLICT',
        detail: 'El alquiler fue modificado por otra operacion - vuelve a cargarlo.',
        statusCode: HttpStatus.PRECONDITION_FAILED,
      },
      HttpStatus.PRECONDITION_FAILED,
    );
  }
}

export class RentalStateConflictError extends ConflictException {
  constructor(action: string, status: RentalStatus) {
    super({
      code: 'RENTAL_STATE_CONFLICT',
      detail: `No se puede ${action} un alquiler en estado ${status}.`,
    });
  }
}

export class InvalidRentalStateTransitionError extends ConflictException {
  constructor(from: RentalStatus, to: RentalStatus) {
    super({
      code: 'INVALID_RENTAL_STATE_TRANSITION',
      detail: `Transicion no permitida de ${from} a ${to}.`,
    });
  }
}

export class RentalScopeForbiddenError extends ForbiddenException {
  constructor() {
    super('El alquiler no pertenece al contexto de trabajo del usuario.');
  }
}

export class AlcoholTestUnfavorableError extends UnprocessableEntityException {
  constructor(result: string) {
    super({
      code: 'ALCOHOL_TEST_UNFAVORABLE',
      detail: `Prueba de alcolimetro no superada (${result}). La entrega queda cancelada por tolerancia cero (BR-ALQ-005).`,
    });
  }
}

export class NotaryExceptionRequiresApprovalError extends ForbiddenException {
  constructor() {
    super({
      code: 'NOTARY_EXCEPTION_REQUIRES_APPROVAL',
      detail: 'La excepcion notarial requiere aprobacion gerencial explicita (BR-ALQ-004).',
    });
  }
}

export class MissingDeliveryEvidenceError extends UnprocessableEntityException {
  constructor(missingDetails: string[]) {
    super({
      code: 'MISSING_REQUIRED_EVIDENCE',
      detail: `No se puede completar la entrega: falta completar la evidencia obligatoria (${missingDetails.join(', ')}).`,
      violations: missingDetails.map((item) => ({
        field: 'evidence',
        rule: 'BR-INS-003/004',
        missing: item,
      })),
    });
  }
}

export class ProhibitedVehicleNotaryExemptionError extends UnprocessableEntityException {
  constructor(model: string) {
    super({
      code: 'PROHIBITED_VEHICLE_NOTARY_EXEMPTION',
      detail: `El vehiculo modelo ${model} tiene prohibicion absoluta de excepcion notarial (BR-ALQ-003). Requiere tramite notarial MANDATORY.`,
    });
  }
}

export class ExtensionAdvanceNoticeError extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'EXTENSION_ADVANCE_NOTICE_REQUIRED',
      detail: 'La ampliacion debe solicitarse con al menos 12 horas de anticipacion al vencimiento actual del alquiler (BR-ALQ-012).',
    });
  }
}

export class ExtensionMaxDurationError extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'EXTENSION_MAX_DURATION_EXCEEDED',
      detail: 'La ampliacion no puede exceder 3 dias consecutivos (1 dia si es por horas) sin firmar un nuevo contrato (BR-ALQ-012).',
    });
  }
}

export class ExtensionNotPendingError extends ConflictException {
  constructor(status: string) {
    super({
      code: 'EXTENSION_NOT_PENDING',
      detail: `No se puede resolver la ampliacion: se encuentra en estado ${status}, no PENDING.`,
    });
  }
}

export class VehicleUnavailableForExtensionError extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'VEHICLE_UNAVAILABLE_FOR_EXTENSION',
      detail: 'El vehiculo tiene otro compromiso (reserva o alquiler) que impide autorizar la ampliacion.',
    });
  }
}
