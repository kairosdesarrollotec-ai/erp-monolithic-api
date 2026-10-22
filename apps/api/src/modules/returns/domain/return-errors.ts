import {
  DomainConflictError,
  DomainError,
  DomainForbiddenError,
  DomainNotFoundError,
  DomainPreconditionError,
  DomainServiceUnavailableError,
  DomainUnprocessableError,
} from '../../../common/domain/domain-errors';

export class ReturnNotFoundError extends DomainNotFoundError {
  readonly code = 'RETURN_NOT_FOUND';

  constructor(id?: string) {
    super(id ? `Devolución ${id} no encontrada.` : 'Devolución no encontrada.');
  }
}

export class ReturnEvidenceNotFoundError extends DomainNotFoundError {
  readonly code = 'RETURN_EVIDENCE_NOT_FOUND';

  constructor(id?: string) {
    super(id ? `Evidencia ${id} no encontrada.` : 'Evidencia no encontrada.');
  }
}

export class ReturnVersionConflictError extends DomainPreconditionError {
  readonly code = 'RETURN_VERSION_CONFLICT';

  constructor() {
    super('La devolución fue modificada por otra operación - vuelve a cargarla.');
  }
}

export class ReturnStateConflictError extends DomainConflictError {
  readonly code = 'RETURN_STATE_CONFLICT';

  constructor(action: string, status: string, reason?: string) {
    super(reason ?? `No se puede ${action} una devolución en estado ${status}.`);
  }
}

export class InvalidReturnStateTransitionError extends DomainConflictError {
  readonly code = 'INVALID_RETURN_STATE_TRANSITION';

  constructor(from: string, to: string) {
    super(`Transición no permitida de ${from} a ${to}.`);
  }
}

export class ReturnScopeForbiddenError extends DomainForbiddenError {
  readonly code = 'RETURN_SCOPE_FORBIDDEN';

  constructor() {
    super('La devolución no pertenece al contexto de trabajo del usuario.');
  }
}

export class TechnicalDamageRequiresExternalReportError extends DomainUnprocessableError {
  readonly code = 'TECHNICAL_DAMAGE_REQUIRES_EXTERNAL_REPORT';

  constructor() {
    super(
      'Todo daño técnico requiere la referencia del informe externo pericial de Motrix — no existe tarifario ni cálculo interno (BR-DEV-006).',
    );
  }
}

export class UnknownCosmeticZoneError extends DomainUnprocessableError {
  readonly code = 'UNKNOWN_COSMETIC_ZONE';

  constructor(zone: string) {
    super(
      `La zona "${zone}" no corresponde al tarifario oficial de daños estéticos por paño (BDD Tabla 9.6.1).`,
    );
  }
}

/** TDD-DEV-001 §11.4: INCIDENT_STILL_OPEN responde 422 (regla de negocio no satisfecha), no 409. */
export class ActiveIncidentsBlockCloseError extends DomainUnprocessableError {
  readonly code = 'INCIDENT_STILL_OPEN';

  constructor(openIncidents: readonly string[] = []) {
    super(
      'No se puede cerrar la devolución: existen incidencias o evaluaciones de daños abiertas pendientes de resolver (DR-DEV-001, NFR-KAI-008).',
      openIncidents.length > 0 ? { openIncidents: [...openIncidents] } : undefined,
    );
  }
}

/**
 * BR-DEV-011 (respuesta de negocio 22-oct-2026): los dias de paralizacion se cuentan desde que se CIERRA la devolucion
 * (estado CERRADA, `closedAt`). Mientras la devolucion no este cerrada el reloj no corre: no hay cargo ni alerta.
 */
export class ImmobilizationClockNotStartedError extends DomainUnprocessableError {
  readonly code = 'IMMOBILIZATION_CLOCK_NOT_STARTED';

  constructor() {
    super(
      'El reloj de paralización arranca al CERRAR la devolución (BR-DEV-011); esta devolución aún no está cerrada, por lo que todavía no corre ningún día de paralización.',
    );
  }
}

export class ImmobilizationPeriodNotElapsedError extends DomainUnprocessableError {
  readonly code = 'IMMOBILIZATION_PERIOD_NOT_ELAPSED';

  constructor() {
    super(
      'Han transcurrido menos de 24 horas naturales desde el cierre de la devolución sin respuesta del cliente; aún no corresponde el cargo por inmovilización (BR-DEV-011).',
    );
  }
}

export class RentalAlreadyHasActiveReturnError extends DomainConflictError {
  readonly code = 'RENTAL_ALREADY_HAS_ACTIVE_RETURN';

  constructor(rentalId: string) {
    super(`El alquiler ${rentalId} ya cuenta con un expediente de devolución en curso.`);
  }
}

export class RentalNotReturnableError extends DomainConflictError {
  readonly code = 'RENTAL_NOT_RETURNABLE';

  constructor(status: string) {
    super(`No se puede iniciar devolución para un alquiler en estado ${status}. Debe estar en ACTIVE o RETURN_IN_PROGRESS.`);
  }
}

export class ReturnRoleNotAllowedError extends DomainForbiddenError {
  readonly code = 'ROLE_NOT_ALLOWED';

  constructor(role: string, action: string) {
    super(`El rol ${role} no tiene permiso para realizar la acción ${action} sobre una Devolución.`);
  }
}

export class ReturnRentalNotFoundError extends DomainNotFoundError {
  readonly code = 'RENTAL_NOT_FOUND';

  constructor(rentalId?: string) {
    super(rentalId ? `Alquiler ${rentalId} no encontrado en la empresa/sede.` : 'Alquiler no encontrado en la empresa/sede.');
  }
}

export class ReturnDamageNotFoundError extends DomainNotFoundError {
  readonly code = 'RETURN_DAMAGE_NOT_FOUND';

  constructor(damageId: string) {
    super(`El daño ${damageId} no pertenece a esta devolución.`);
  }
}

export class InvalidAestheticDamageError extends DomainUnprocessableError {
  readonly code = 'INVALID_AESTHETIC_DAMAGE';

  constructor() {
    super(
      'Un daño estético se valora únicamente con el tarifario por paño; no admite referencia a informe externo (BR-DEV-006).',
    );
  }
}

export class MissingReturnEvidenceError extends DomainUnprocessableError {
  readonly code = 'MISSING_REQUIRED_EVIDENCE';

  constructor(missingDetails: string[]) {
    super(
      `No se puede completar la inspección: falta evidencia obligatoria del checklist de retorno (BR-DEV-009). ${missingDetails.join('; ')}.`,
      { missing: missingDetails },
    );
  }
}

export class MissingResponsibilityDocumentError extends DomainUnprocessableError {
  readonly code = 'MISSING_RESPONSIBILITY_DOCUMENT';

  constructor(detail?: string) {
    super(
      detail ??
        'No se puede completar la inspección: falta el documento de responsabilidad firmado por quien devuelve el vehículo (BR-DEV-009, DAT-DEV-005, EX-DEV-001).',
    );
  }
}

export class InvalidImmobilizationChargeError extends DomainUnprocessableError {
  readonly code = 'INVALID_IMMOBILIZATION_CHARGE';

  constructor(detail: string) {
    super(detail);
  }
}

export class InvalidFinancialSettlementError extends DomainUnprocessableError {
  readonly code = 'INVALID_FINANCIAL_SETTLEMENT';

  constructor(detail: string) {
    super(detail);
  }
}

export class ReturnDepositAlreadySettledError extends DomainConflictError {
  readonly code = 'DEPOSIT_ALREADY_SETTLED';

  constructor(status: string) {
    super(`La garantía del alquiler ya fue liquidada (estado ${status}).`);
  }
}

export class InvalidReturnEvidenceError extends DomainError {
  readonly code = 'INVALID_RETURN_EVIDENCE';
  readonly httpStatus = 400;

  constructor(detail: string) {
    super(detail);
  }
}

export class ReturnStorageUnavailableError extends DomainServiceUnavailableError {
  readonly code = 'EVIDENCE_STORAGE_UNAVAILABLE';

  constructor() {
    super('Almacenamiento de evidencia no configurado (variables de entorno GCS faltantes).');
  }
}

/** DEV-01 / BR-DEV-004: el recordatorio previo aún no existe (el scheduler lo genera 3 h antes de la hora pactada). */
export class ReturnReminderNotFoundError extends DomainNotFoundError {
  readonly code = 'RETURN_REMINDER_NOT_FOUND';

  constructor(returnId?: string) {
    super(
      returnId
        ? `La devolución ${returnId} aún no tiene un recordatorio generado (se genera 3 horas antes de la hora pactada).`
        : 'La devolución aún no tiene un recordatorio generado.',
    );
  }
}

export class ReturnReminderAlreadySentError extends DomainConflictError {
  readonly code = 'RETURN_REMINDER_ALREADY_SENT';

  constructor() {
    super('El recordatorio de esta devolución ya fue registrado como enviado.');
  }
}

export class ReturnReminderVersionConflictError extends DomainPreconditionError {
  readonly code = 'RETURN_REMINDER_VERSION_CONFLICT';

  constructor() {
    super('El recordatorio fue modificado por otra operación - vuelve a cargarlo.');
  }
}

export class InvalidReturnReminderResultError extends DomainUnprocessableError {
  readonly code = 'INVALID_RETURN_REMINDER_RESULT';

  constructor(detail: string) {
    super(detail);
  }
}

/** DEC-ALQ-COMPANY-DRIVER-004: alquiler con conductor de la empresa = sin garantia; no hay nada que reembolsar ni retener. */
export class ReturnNoDepositToSettleError extends DomainUnprocessableError {
  readonly code = 'RETURN_NO_DEPOSIT_TO_SETTLE';

  constructor() {
    super('El alquiler es con conductor de la empresa: no tiene garantia, por lo que no hay reembolso ni retencion. Use 0 en refundAmount y retainedAmount.');
  }
}

/** Fiorella 2026-10-16 (DEV-03): alcoholímetro desfavorable = check "no cumple rango" + foto de la prueba OBLIGATORIA. */
export class AlcoholTestPhotoRequiredError extends DomainUnprocessableError {
  readonly code = 'ALCOHOL_TEST_PHOTO_REQUIRED';

  constructor() {
    super(
      'Un alcolímetro desfavorable (no cumple el rango) exige la foto de la prueba como evidencia (zona ALCOHOL_TEST). Súbela antes de registrar el resultado.',
    );
  }
}

/** DEC-DEV-LATE-CHARGE-002: el cargo manual por retraso solo procede si la devolución superó la tolerancia. */
export class InvalidLateChargeError extends DomainUnprocessableError {
  readonly code = 'INVALID_LATE_CHARGE';

  constructor(detail: string) {
    super(detail);
  }
}

/** DEV-05 / PD-07: zona o marca fuera del catalogo, zona repetida o lista vacia en `POST /returns/{id}/zone-marks`. */
export class InvalidZoneMarkError extends DomainUnprocessableError {
  readonly code = 'INVALID_ZONE_MARK';

  constructor(detail: string) {
    super(detail);
  }
}
