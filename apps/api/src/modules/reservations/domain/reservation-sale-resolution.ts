import { DomainConflictError, DomainUnprocessableError } from '../../../common/domain/domain-errors';

/**
 * UC-RES-004 / BR-RES-007 (RES-P13 a RES-P16, RES-06/RES-07) - resolucion ante
 * la venta de un vehiculo reservado. Ver DEC-RES-SALE-001 en docs/decision-log.md.
 */

/** Motivo de la fila de resolucion (TDD-RES-001.md seccion 9.3: DEFAULT 'VEHICLE_SOLD'). */
export const SALE_RESOLUTION_REASON = 'VEHICLE_SOLD';

/** Motivo de cancelacion cuando el cliente rechaza la alternativa (reembolso inmediato, BR-RES-007). */
export const SALE_REFUND_CANCEL_REASON = 'VEHICLE_SOLD_REFUND';

/** Decision del cliente enviada en resolve-sale. */
export const SALE_DECISIONS = ['ACCEPT_ALTERNATIVE', 'REJECT'] as const;
export type SaleDecision = (typeof SALE_DECISIONS)[number];

/** `customer_decision` persistido (TDD-RES-001.md 9.3); NULL = pendiente. */
export type StoredCustomerDecision = 'ACCEPTED' | 'REJECTED';

/**
 * Estado del reembolso del rechazo. NO existe integracion de pagos: la
 * transferencia la hace Gerencia a mano (@SC-RES-006.01) y el sistema solo
 * deja constancia de que esta pendiente.
 */
export type SaleRefundStatus = 'PENDING_TRANSFER' | 'TRANSFERRED';

export type SaleResolutionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface SaleVehicleSummary {
  id: string;
  plate: string;
  label: string;
}

export interface ReservationSaleResolutionRecord {
  id: string;
  reservationId: string;
  reason: string;
  status: SaleResolutionStatus;
  originalVehicleId: string;
  /** Alternativa ofrecida al registrar la venta (RES-P14); null si aun no se ofrecio una. */
  offeredVehicle: SaleVehicleSummary | null;
  offerNote: string | null;
  flaggedBy: string;
  flaggedAt: Date;
  /** Alternativa efectivamente elegida (solo ACCEPTED). */
  alternativeVehicleId: string | null;
  refundStatus: SaleRefundStatus | null;
  transferVoucher?: string | null;
  transferredAt?: Date | null;
  transferredBy?: string | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
}

/** 422 - ACCEPT_ALTERNATIVE sin alternativa en el comando ni ofrecida antes. */
export class AlternativeVehicleRequiredError extends DomainUnprocessableError {
  readonly code = 'ALTERNATIVE_VEHICLE_REQUIRED';

  constructor() {
    super('Para aceptar la alternativa indica el vehiculo alternativo (alternativeVehicleId) o registra uno al notificar la venta.');
  }
}

/** 422 - el vehiculo alternativo no es utilizable (otra empresa/sede, mismo vehiculo, no AVAILABLE...). */
export class AlternativeVehicleInvalidError extends DomainUnprocessableError {
  readonly code = 'ALTERNATIVE_VEHICLE_INVALID';

  constructor(detail: string) {
    super(detail);
  }
}

/** 409 - ya hay una resolucion de venta abierta para la reserva (defensa del indice unico parcial). */
export class SaleResolutionAlreadyOpenError extends DomainConflictError {
  readonly code = 'SALE_RESOLUTION_ALREADY_OPEN';

  constructor() {
    super('La reserva ya tiene una venta de vehiculo pendiente de resolucion.');
  }
}
