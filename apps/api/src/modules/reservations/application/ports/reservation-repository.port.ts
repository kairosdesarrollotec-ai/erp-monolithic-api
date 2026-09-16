import { ReservationStatus } from '../../domain/reservation-status';
import { ChannelMode } from '../../domain/channel-mode';

export interface ReservationRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  inquiryId: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleLabel: string;
  status: ReservationStatus;
  channelMode: ChannelMode;
  startAt: Date;
  endAt: Date;
  requiredPaymentAmount: string;
  currency: string;
  paymentPolicyVersion: number;
  paymentValidatedAt: Date | null;
  documentsCompletedAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  createdBy: string;
  version: number;
}

export interface CreateReservationInput {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  inquiryId: string;
  customerId: string;
  vehicleId: string;
  channelMode: ChannelMode;
  startAt: Date;
  endAt: Date;
  requiredPaymentAmount: string;
  currency: string;
  paymentPolicyVersion: number;
  createdBy: string;
}

export interface ListReservationsFilter {
  organizationId: string;
  operatingCompanyId?: string;
  status?: ReservationStatus;
}

export interface CancelReservationInput {
  id: string;
  organizationId: string;
  expectedVersion: number;
  reason: string;
  note?: string;
}

/**
 * TDD-RES-001.md secciones 9-12 - puerto de persistencia de Reserva.
 * `confirm` encapsula la transaccion atomica de la seccion 10.1
 * (verificar ambos requisitos + solicitar vehicle_commitment + transicionar
 * a CONFIRMED, todo o nada).
 */
export abstract class ReservationRepositoryPort {
  abstract create(input: CreateReservationInput): Promise<ReservationRecord>;
  abstract findById(id: string, organizationId: string): Promise<ReservationRecord | null>;
  abstract list(filter: ListReservationsFilter): Promise<ReservationRecord[]>;

  abstract registerPayment(
    id: string,
    organizationId: string,
    expectedVersion: number,
  ): Promise<ReservationRecord>;

  abstract registerDocuments(
    id: string,
    organizationId: string,
    expectedVersion: number,
  ): Promise<ReservationRecord>;

  /** Seccion 10.1 del TDD: transaccion atomica unica. */
  abstract confirm(
    id: string,
    organizationId: string,
    expectedVersion: number,
  ): Promise<ReservationRecord>;

  abstract cancel(input: CancelReservationInput): Promise<ReservationRecord>;
}
