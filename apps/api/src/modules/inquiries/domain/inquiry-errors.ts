import {
  DomainConflictError,
  DomainPreconditionError,
  DomainServiceUnavailableError,
  DomainUnprocessableError,
} from '../../../common/domain/domain-errors';

/**
 * Conflicto real de version optimista: precondition failure sobre el
 * recurso (RFC 9110 13.1.2) - 412 INQUIRY_VERSION_CONFLICT
 * (TDD-CON-001.md 10.1).
 */
export class InquiryVersionConflictError extends DomainPreconditionError {
  readonly code = 'INQUIRY_VERSION_CONFLICT';

  constructor() {
    super('La consulta fue modificada por otra operacion - vuelve a cargarla.');
  }
}

/** BR-CON-002 - una consulta cerrada o ya convertida es terminal. */
export class InquiryNotTransitionableError extends DomainUnprocessableError {
  readonly code = 'INQUIRY_NOT_TRANSITIONABLE';

  constructor(currentStatus: string) {
    super(`La consulta esta en estado ${currentStatus} y no admite esta transicion.`);
  }
}

/**
 * Hallazgo ALTO de revalidacion PR#7 ("conversion acepta cotizaciones
 * vencidas"): la ultima cotizacion de la consulta ya no esta vigente
 * (`validUntil` <= ahora). Hay que volver a cotizar antes de convertir.
 */
export class QuotationExpiredError extends DomainConflictError {
  readonly code = 'QUOTATION_EXPIRED';

  constructor(validUntil: Date) {
    super(`La cotizacion vigente de la consulta vencio el ${validUntil.toISOString()} - vuelve a cotizar antes de reservar.`);
  }
}

/** BR-CON-005 - el vehiculo no es elegible (o no pertenece a la empresa) para esta consulta. */
export class VehicleNotEligibleError extends DomainUnprocessableError {
  readonly code = 'VEHICLE_NOT_ELIGIBLE';

  constructor(reason: string) {
    super(reason);
  }
}

/**
 * Hallazgo ALTO de revalidacion PR#7 ("Fleet/tarifario pendientes antes de
 * produccion"): el tarifario y la elegibilidad de Flota siguen siendo
 * adaptadores PROVISIONALES. En produccion se rechaza cotizar/convertir
 * (503) salvo habilitacion explicita (`KAIROS_ALLOW_PROVISIONAL_QUOTING`),
 * para que el flujo provisional no pueda quedar habilitado por omision.
 */
export class QuotingNotProductionReadyError extends DomainServiceUnavailableError {
  readonly code = 'QUOTING_NOT_PRODUCTION_READY';

  constructor(component: string) {
    super(`${component} todavia es provisional y no esta habilitado para produccion.`);
  }
}

/** Una consulta se convierte a lo sumo en UNA reserva (UNIQUE reservations.inquiry_id). */
export class InquiryAlreadyConvertedError extends DomainConflictError {
  readonly code = 'INQUIRY_ALREADY_CONVERTED';

  constructor() {
    super('La consulta ya tiene una reserva asociada.');
  }
}

/**
 * CON-P03 / DT-CON-03 (hallazgo CON P-05) - la consulta declara que el uso NO
 * es turistico: no se cotiza ni se convierte; el unico camino es cerrarla sin
 * conversion con motivo (`POST /inquiries/{id}/commands/close`, motivo sugerido
 * SIN_USO_TURISTICO).
 */
export class InquiryNotTouristUseError extends DomainUnprocessableError {
  readonly code = 'INQUIRY_NOT_TOURIST_USE';

  constructor() {
    super('La consulta no tiene uso turistico: no se puede cotizar ni convertir. Cierrala sin conversion indicando el motivo.');
  }
}

/** DEC-CON-TROCHA-001 - La consulta incluye trocha pero el vehículo seleccionado no es apto para trocha. */
export class VehicleNotSuitableForTrochaError extends DomainUnprocessableError {
  readonly code = 'VEHICLE_NOT_SUITABLE_FOR_TROCHA';

  constructor() {
    super('El vehículo seleccionado no es apto para trocha / carretera afirmada.');
  }
}

/** DEC-R1-FIX-001 - El vehículo no tiene tarifa configurada para el plan elegido. */
export class PlanRateNotConfiguredError extends DomainUnprocessableError {
  readonly code = 'PLAN_RATE_NOT_CONFIGURED';

  constructor(plan: string) {
    super(`Falta configurar la tarifa del plan ${plan} para este vehículo.`);
  }
}



/** Decisiones 29-oct #3: un cliente ROJO no se atiende en ningun proceso (tampoco registrar ni cotizar consultas). */
export class InquiryCustomerRedError extends DomainUnprocessableError {
  readonly code = 'CUSTOMER_BLOCKED';

  constructor() {
    super('El cliente esta en estado ROJO y no se le atiende en ningun proceso (consulta, reserva ni alquiler).');
  }
}

/** CR-09: dias estimados invalidos (0, negativos o decimales). */
export class InvalidEstimatedDaysError extends DomainUnprocessableError {
  readonly code = 'INVALID_ESTIMATED_DAYS';

  constructor() {
    super('El numero estimado de dias debe ser un entero mayor a cero.');
  }
}
