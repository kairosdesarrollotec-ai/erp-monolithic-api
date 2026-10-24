import type { Prisma } from '@prisma/client';
import { VehicleDataWarning } from '../../../../common/domain/vehicle-data-warnings';
import { ReservationStatus } from '../../domain/reservation-status';
import { ChannelMode, CustomerLocation } from '../../domain/channel-mode';
import { PaymentMethod } from '../../domain/reservation-payment-method';

export interface ReservationRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  inquiryId: string | null;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleLabel: string;
  /** DEC-ALQ-VEHDATA-001: avisos por datos faltantes del vehiculo (capacidad, garantia, combustible). */
  vehicleWarnings?: VehicleDataWarning[];
  status: ReservationStatus;
  channelMode: ChannelMode;
  canComeToOffice?: boolean | null;
  customerLocation?: CustomerLocation | null;
  startAt: Date;
  endAt: Date;
  requiredPaymentAmount: string;
  currency: string;
  paymentPolicyVersion: number;
  paymentValidatedAt: Date | null;
  documentsCompletedAt: Date | null;
  /** Requisitos remotos (BR-RES-005, BR-RES-006, SC-RES-003). */
  video360Uploaded?: boolean;
  signedAcceptanceUploaded?: boolean;
  confirmedAt: Date | null;
  /** Decision 8 (22-oct-2026): comprobante del pago registrado (null mientras no se registre). */
  payment?: ReservationPaymentRecord | null;
  createdAt: Date;
  createdBy: string;
  version: number;
}

export interface ReservationPaymentRecord {
  amount: string;
  method: PaymentMethod;
  /** Nº de operacion, o nº de recibo si el metodo es EFECTIVO. */
  operationNumber: string | null;
  payerName: string;
  voucherDocumentId: string | null;
  registeredBy: string | null;
}

export interface RegisterReservationPaymentInput {
  amount: string;
  method: PaymentMethod;
  operationNumber?: string;
  payerName: string;
  voucherDocumentId?: string;
  registeredBy: string;
}

export interface CreateReservationInput {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  inquiryId?: string;
  customerId: string;
  vehicleId: string;
  channelMode: ChannelMode;
  canComeToOffice?: boolean | null;
  customerLocation?: CustomerLocation | null;
  startAt: Date;
  endAt: Date;
  requiredPaymentAmount: string;
  currency: string;
  paymentPolicyVersion: number;
  createdBy: string;
}

export interface ReservationCustomerRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  /** Semaforo de riesgo del cliente (NORMAL | AMBAR | ROJO). ROJO bloquea (CUSTOMER_BLOCKED). */
  status?: string;
}

export interface ReservationVehicleRecord {
  id: string;
  operatingCompanyId: string;
  /** Garantia del vehiculo (Flota, `deposit_minimum`); null/ausente = no definida. */
  depositMinimum?: number | null;
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
 * CONFLICT-CON-001 (resuelto): se reintroducen findCustomerById y
 * findVehicleById para que CreateReservationHandler pueda validar scope
 * en la creacion directa.
 */
export abstract class ReservationRepositoryPort {
  abstract findCustomerById(id: string): Promise<ReservationCustomerRecord | null>;
  abstract findVehicleById(id: string): Promise<ReservationVehicleRecord | null>;
  abstract isVehicleAvailable(vehicleId: string, startAt: Date, endAt: Date): Promise<boolean>;

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


  abstract registerPayment(
    id: string,
    scope: ReservationScope,
    expectedVersion: number,
    payment: RegisterReservationPaymentInput,
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
