import type { Prisma } from '@prisma/client';
import { InquiryStatus } from '../../domain/inquiry-status';
import { InquiryChannel } from '../../domain/inquiry-channel';
import { InquiryNationality } from '../../domain/inquiry-nationality';
import { InquiryDataOrigin } from '../../domain/inquiry-data-origin';

export interface QuotationRecord {
  id: string;
  vehicleId: string;
  rateCardVersionId: string;
  destination: string;
  estimatedDays: number;
  amount: string;
  currency: string;
  validUntil: Date;
  createdAt: Date;
}

export interface InteractionRecord {
  id: string;
  channel: InquiryChannel;
  occurredAt: Date;
  outcome: string | null;
  note: string | null;
}

/**
 * Snapshot del viaje capturado en CON-02 (CONFLICT-CON-002 resuelto):
 * la identidad del prospecto (nombre, documento, nacionalidad) se persiste
 * en Customer; Inquiry conserva solo el contexto del viaje.
 * Todos los campos son `null` solo en consultas `LEGACY_STUB`.
 */
export interface InquirySnapshot {
  destination: string | null;
  estimatedDays: number | null;
  travelStartDate: Date | null;
  partySize: number | null;
}

/**
 * Hallazgo MEDIO de revalidacion PR#7 ("listado carga historial completo por
 * fila"): la bandeja (CON-01) usa esta proyeccion de resumen - sin
 * interactions ni quotations. Solo el detalle (CON-04) carga el historial.
 */
export interface InquirySummaryRecord extends InquirySnapshot {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  customerId: string | null;
  channel: InquiryChannel | null;
  touristUse: boolean;
  dataOrigin: InquiryDataOrigin;
  status: InquiryStatus;
  closedReason: string | null;
  createdAt: Date;
  createdBy: string;
  version: number;
}

export interface InquiryRecord extends InquirySummaryRecord {
  interactions: InteractionRecord[];
  quotations: QuotationRecord[];
}

export interface CreateInquiryInput {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  customerId: string;
  channel: InquiryChannel;
  touristUse: boolean;
  destination: string;
  estimatedDays: number;
  travelStartDate?: Date;
  partySize?: number;
  createdBy: string;
}

/**
 * Toda lectura o mutacion puntual se identifica por el scope completo
 * (organizationId + operatingCompanyId + branchId), nunca solo por
 * organizationId - mismo criterio que `ReservationScope` desde PR#6.
 */
export interface InquiryScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export interface ListInquiriesFilter extends InquiryScope {
  customerId?: string;
  channel?: InquiryChannel;
  status?: InquiryStatus;
  createdFrom?: Date;
  createdTo?: Date;
  /**
   * Hallazgo MEDIO de revalidacion PR#7 ("el cursor temporal se ignora"):
   * keyset real sobre (createdAt DESC, id DESC) - la pagina siguiente
   * trae las filas estrictamente anteriores a este par.
   */
  cursor?: { createdAt: Date; id: string };
  limit: number;
}

export interface QuoteInquiryInput extends InquiryScope {
  id: string;
  expectedVersion: number;
  vehicleId: string;
  destination: string;
  estimatedDays: number;
  amount: string;
  currency: string;
  rateCardVersionId: string;
  validUntil: Date;
}

export interface CloseInquiryInput extends InquiryScope {
  id: string;
  expectedVersion: number;
  reason: string;
  note?: string;
}

export interface ConvertToReservationInput extends InquiryScope {
  id: string;
  expectedVersion: number;
}

export type ConvertToRentalInput = ConvertToReservationInput;

export interface CustomerRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  fullName: string;
  nationality: InquiryNationality | null;
  countryEntryDate: Date | null;
}

export interface CreateCustomerInput {
  organizationId: string;
  operatingCompanyId: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  nationality: InquiryNationality;
  countryEntryDate?: Date;
}

/**
 * TDD-CON-001.md secciones 9-12 - puerto de persistencia de Consulta.
 *
 * - `quote` crea el snapshot `Quotation` y transiciona a COTIZADA en una
 *   sola transaccion, condicionada por version y estado de origen.
 * - `close`/`convertToReservation` reciben `tx` para que el llamador
 *   incluya auditoria (y, en la conversion, la creacion de la Reserva) en
 *   la misma transaccion.
 */
export abstract class InquiryRepositoryPort {
  abstract create(input: CreateInquiryInput): Promise<InquiryRecord>;
  abstract findById(id: string, scope: InquiryScope, tx?: Prisma.TransactionClient): Promise<InquiryRecord | null>;
  abstract list(filter: ListInquiriesFilter): Promise<InquirySummaryRecord[]>;

  abstract findCustomerById(id: string): Promise<CustomerRecord | null>;
  abstract createCustomer(input: CreateCustomerInput): Promise<CustomerRecord>;

  abstract quote(input: QuoteInquiryInput, fromStatuses: InquiryStatus[]): Promise<InquiryRecord>;

  abstract close(
    input: CloseInquiryInput,
    fromStatuses: InquiryStatus[],
    tx?: Prisma.TransactionClient,
  ): Promise<InquiryRecord>;

  abstract convertToReservation(
    input: ConvertToReservationInput,
    fromStatuses: InquiryStatus[],
    tx: Prisma.TransactionClient,
  ): Promise<InquiryRecord>;

  /** Mismo contrato que `convertToReservation` (COTIZADA -> CONVERTIDA), para Alquiler directo. */
  abstract convertToRental(
    input: ConvertToRentalInput,
    fromStatuses: InquiryStatus[],
    tx: Prisma.TransactionClient,
  ): Promise<InquiryRecord>;
}
