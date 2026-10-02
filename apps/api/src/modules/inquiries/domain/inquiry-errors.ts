import {
  ConflictException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * Conflicto real de version optimista: precondition failure sobre el
 * recurso (RFC 9110 13.1.2) - 412 INQUIRY_VERSION_CONFLICT
 * (TDD-CON-001.md 10.1).
 */
export class InquiryVersionConflictError extends HttpException {
  constructor() {
    super(
      {
        code: 'INQUIRY_VERSION_CONFLICT',
        detail: 'La consulta fue modificada por otra operacion - vuelve a cargarla.',
        statusCode: HttpStatus.PRECONDITION_FAILED,
      },
      HttpStatus.PRECONDITION_FAILED,
    );
  }
}

/** BR-CON-002 - una consulta cerrada o ya convertida es terminal. */
export class InquiryNotTransitionableError extends UnprocessableEntityException {
  constructor(currentStatus: string) {
    super({
      code: 'INQUIRY_NOT_TRANSITIONABLE',
      detail: `La consulta esta en estado ${currentStatus} y no admite esta transicion.`,
    });
  }
}

/**
 * Hallazgo ALTO de revalidacion PR#7 ("conversion acepta cotizaciones
 * vencidas"): la ultima cotizacion de la consulta ya no esta vigente
 * (`validUntil` <= ahora). Hay que volver a cotizar antes de convertir.
 */
export class QuotationExpiredError extends ConflictException {
  constructor(validUntil: Date) {
    super({
      code: 'QUOTATION_EXPIRED',
      detail: `La cotizacion vigente de la consulta vencio el ${validUntil.toISOString()} - vuelve a cotizar antes de reservar.`,
    });
  }
}

/** BR-CON-005 - el vehiculo no es elegible (o no pertenece a la empresa) para esta consulta. */
export class VehicleNotEligibleError extends UnprocessableEntityException {
  constructor(reason: string) {
    super({ code: 'VEHICLE_NOT_ELIGIBLE', detail: reason });
  }
}

/**
 * Hallazgo ALTO de revalidacion PR#7 ("Fleet/tarifario pendientes antes de
 * produccion"): el tarifario y la elegibilidad de Flota siguen siendo
 * adaptadores PROVISIONALES. En produccion se rechaza cotizar/convertir
 * (503) salvo habilitacion explicita (`KAIROS_ALLOW_PROVISIONAL_QUOTING`),
 * para que el flujo provisional no pueda quedar habilitado por omision.
 */
export class QuotingNotProductionReadyError extends ServiceUnavailableException {
  constructor(component: string) {
    super({
      code: 'QUOTING_NOT_PRODUCTION_READY',
      detail: `${component} todavia es provisional y no esta habilitado para produccion.`,
    });
  }
}

/**
 * @deprecated (oct 2026) Sin uso - RateCardPort/rate_card_versions ya no
 * es la fuente del precio de cotizacion (ver quote.handler.ts y
 * fleet-availability.port.ts). Se mantiene la clase sin borrar por si
 * algun consumidor externo del paquete todavia la importa; no se lanza
 * desde ningun handler.
 */
export class RateCardNotConfiguredError extends ServiceUnavailableException {
  constructor(operatingCompanyId: string) {
    super({
      code: 'RATE_CARD_NOT_CONFIGURED',
      detail: `No hay tarifa configurada para la empresa ${operatingCompanyId} a esta fecha. Configure una tarifa antes de cotizar.`,
    });
  }
}

/** Una consulta se convierte a lo sumo en UNA reserva (UNIQUE reservations.inquiry_id). */
export class InquiryAlreadyConvertedError extends ConflictException {
  constructor() {
    super({
      code: 'INQUIRY_ALREADY_CONVERTED',
      detail: 'La consulta ya tiene una reserva asociada.',
    });
  }
}
