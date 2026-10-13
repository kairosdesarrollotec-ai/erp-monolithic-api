import type { Prisma } from '@prisma/client';
import type { ReservationRecord, ReservationScope } from './reservation-repository.port';
import type { ReservationSaleResolutionRecord } from '../../domain/reservation-sale-resolution';

/** Vehiculo candidato a alternativa (lo minimo para validar empresa/sede/estado). */
export interface SaleAlternativeVehicleRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string | null;
  status: string;
  plate: string;
}

export interface FlagSaleInput extends ReservationScope {
  id: string;
  expectedVersion: number;
  flaggedBy: string;
  offeredVehicleId?: string;
  note?: string;
}

export interface RejectSaleInput extends ReservationScope {
  id: string;
  expectedVersion: number;
  resolvedBy: string;
  note?: string;
}

export interface AcceptSaleInput extends ReservationScope {
  id: string;
  expectedVersion: number;
  resolvedBy: string;
  alternativeVehicleId: string;
  note?: string;
}

/**
 * Puerto de persistencia de la venta de vehiculo reservado (UC-RES-004,
 * tabla `reservation_resolutions`). Separado de ReservationRepositoryPort para
 * no ampliar el contrato de todos los demas casos de uso de Reserva. Todas
 * las mutaciones exigen `tx` (las abre el handler con TransactionManagerPort,
 * Serializable) y usan `updateMany` atomico con scope + version + estado en
 * el where, igual que `cancel`.
 */
export abstract class ReservationSaleResolutionRepositoryPort {
  abstract findVehicleById(id: string, tx?: Prisma.TransactionClient): Promise<SaleAlternativeVehicleRecord | null>;

  /** Solape [from, to) por la regla compartida (common/persistence/vehicle-overlap.ts), ignorando la propia reserva. */
  abstract findVehicleConflict(
    vehicleId: string,
    from: Date,
    to: Date,
    excludeReservationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ from: Date; to: Date } | null>;

  /** Ultima resolucion de la reserva (abierta o cerrada); null si nunca hubo venta. */
  abstract findLatestByReservationId(
    reservationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationSaleResolutionRecord | null>;

  /** CONFIRMED -> PENDING_SALE_RESOLUTION + fila de resolucion abierta. El commitment NO se toca. */
  abstract flagSale(input: FlagSaleInput, tx: Prisma.TransactionClient): Promise<ReservationRecord>;

  /** PENDING_SALE_RESOLUTION -> CANCELLED (VEHICLE_SOLD_REFUND), libera el commitment, deja el reembolso PENDING_TRANSFER. */
  abstract rejectSale(input: RejectSaleInput, tx: Prisma.TransactionClient): Promise<ReservationRecord>;

  /**
   * PENDING_SALE_RESOLUTION -> DRAFT sobre el vehiculo alternativo: libera el
   * commitment del vehiculo vendido, conserva `payment_validated_at`, limpia
   * `documents_completed_at` y `confirmed_at` (el cliente reenvia requisitos,
   * BDD 10.6) y cierra la resolucion como ACCEPTED.
   */
  abstract acceptAlternative(input: AcceptSaleInput, tx: Prisma.TransactionClient): Promise<ReservationRecord>;
}
