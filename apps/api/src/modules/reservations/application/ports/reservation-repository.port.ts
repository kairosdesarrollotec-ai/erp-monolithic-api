import type { Prisma } from '@prisma/client';
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

/**
 * Hallazgo critico de revision PR#6 ("IDOR entre sedes/empresas"): toda
 * lectura o mutacion puntual de una reserva se identifica ahora por este
 * scope completo (organizationId + operatingCompanyId + branchId), nunca
 * solo por organizationId. Una asignacion valida del usuario a una
 * empresa/sede de la organizacion ya NO alcanza para leer/mutar una
 * reserva de otra empresa/sede de esa misma organizacion - el scope
 * exacto validado por WorkContextAuthorizationService.authorize() debe
 * coincidir exactamente con el de la fila, o se trata como inexistente
 * (404), no como prohibido (evita confirmar a un atacante que el id
 * existe en otra sede).
 */
export interface ReservationScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export interface ListReservationsFilter extends ReservationScope {
  status?: ReservationStatus;
  cursor?: { createdAt: Date; id: string };
  limit: number;
}

export interface CancelReservationInput extends ReservationScope {
  id: string;
  expectedVersion: number;
  reason: string;
  note?: string;
}

export interface CustomerRecord {
  id: string;
  organizationId: string;
}

export interface VehicleRecord {
  id: string;
  organizationId: string;
}

export interface InquiryRecord {
  id: string;
  organizationId: string;
}

/**
 * TDD-RES-001.md secciones 9-12 - puerto de persistencia de Reserva.
 *
 * Hallazgo critico "cambio de estado y auditoria no son atomicos": las
 * mutaciones aceptan un `tx` opcional (mismo patron que
 * TransactionManagerPort/WorkContextRepositoryPort desde PR#4). El
 * handler abre la transaccion (via TransactionManagerPort.run, con
 * Serializable cuando corresponde - TDD-RES-001.md seccion 10.1) y se la
 * pasa a estos metodos, para que la escritura de auditoria del handler
 * participe de la misma transaccion que la mutacion - un fallo de
 * auditoria revierte tambien la mutacion. El repositorio ya no abre su
 * propia transaccion anidada.
 *
 * Hallazgo critico "referencias cross-tenant al crear": findCustomerById/
 * findVehicleById/findInquiryById existen para que CreateReservationHandler
 * pueda resolver estas entidades bajo el scope autorizado ANTES de crear
 * la reserva, en vez de confiar ciegamente en los IDs del payload.
 */
export abstract class ReservationRepositoryPort {
  abstract create(
    input: CreateReservationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord>;

  abstract findById(
    id: string,
    scope: ReservationScope,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord | null>;

  abstract list(filter: ListReservationsFilter): Promise<ReservationRecord[]>;

  abstract findCustomerById(id: string): Promise<CustomerRecord | null>;
  abstract findVehicleById(id: string): Promise<VehicleRecord | null>;
  abstract findInquiryById(id: string): Promise<InquiryRecord | null>;

  abstract registerPayment(
    id: string,
    scope: ReservationScope,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord>;

  abstract registerDocuments(
    id: string,
    scope: ReservationScope,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord>;

  /** Seccion 10.1 del TDD: transaccion atomica unica (Serializable, ver TransactionManagerPort). */
  abstract confirm(
    id: string,
    scope: ReservationScope,
    expectedVersion: number,
    tx: Prisma.TransactionClient,
  ): Promise<ReservationRecord>;

  abstract cancel(
    input: CancelReservationInput,
    tx: Prisma.TransactionClient,
  ): Promise<ReservationRecord>;
}
