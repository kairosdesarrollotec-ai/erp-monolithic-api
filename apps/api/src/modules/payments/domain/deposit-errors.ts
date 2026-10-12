import { DomainConflictError, DomainNotFoundError, DomainBadRequestError } from '../../../common/domain/domain-errors';

/** PAG-02: garantia no encontrada en la empresa/sede del actor (responde 404, nunca 403 — no revela existencia). */
export class DepositNotFoundError extends DomainNotFoundError {
  readonly code = 'DEPOSIT_NOT_FOUND';

  constructor(id?: string) {
    super(id ? `Garantia ${id} no encontrada en la empresa/sede.` : 'Garantia no encontrada en la empresa/sede.');
  }
}

/**
 * La garantia esta en un estado terminal (RETURNED / RETAINED / PARTIALLY_RETAINED) y no admite mas cambios.
 * payments.yaml: 409 DEPOSIT_IN_TERMINAL_STATE.
 */
export class DepositInTerminalStateError extends DomainConflictError {
  readonly code = 'DEPOSIT_IN_TERMINAL_STATE';

  constructor(status: string) {
    super(`La garantia esta en estado ${status} y ya no admite cambios.`);
  }
}

/**
 * BR-PAG-001: la suma de los ajustes existentes mas el nuevo monto supera el monto original de la garantia.
 * payments.yaml: 400.
 */
export class AdjustmentAmountExceedsDepositError extends DomainBadRequestError {
  readonly code = 'ADJUSTMENT_AMOUNT_EXCEEDS_DEPOSIT';

  constructor(available: number, requested: number) {
    super(`El monto solicitado (${requested}) supera el saldo disponible de la garantia (${available}).`);
  }
}

/**
 * BR-PAG-005: existe un ajuste FULL_RETENTION activo — la devolucion no puede aprobarse.
 * payments.yaml: 409 PENDING_DAMAGE_RESOLUTION.
 */
export class PendingDamageResolutionError extends DomainConflictError {
  readonly code = 'PENDING_DAMAGE_RESOLUTION';

  constructor() {
    super('Existen danos activos pendientes de resolucion gerencial — la garantia no puede devolverse.');
  }
}
