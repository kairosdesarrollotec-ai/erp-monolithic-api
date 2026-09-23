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
 * Hallazgo ALTO de revalidacion PR#7 ("brecha contractual con CON-02"):
 * snapshot de lo capturado en CON-02 (PANTALLAS-V3-B-CONSULTA.md punto 6 /
 * BDD-CON-001.md DAT-CON-001..004). Todos los campos son `null` solo en
 * consultas `LEGACY_STUB` (ver domain/inquiry-data-origin.ts).
 */
export interface InquirySnapshot {
  prospectName: string | null;
  prospectDocumentType: string | null;
  prospectDocumentNumber: string | null;
  nationality: InquiryNationality | null;
  destination: string | null;
  estimatedDays: number | null;
  travelStartDate: Date | null;
  partySize: number | null;
  countryEntryDate: Date | null;
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
  customerId?: string;
  channel: InquiryChannel;
  touristUse: boolean;
  prospectName?: string;
  prospectDocumentType?: string;
  prospectDocumentNumber?: string;
  nationality: InquiryNationality;
  destination: string;
  estimatedDays: number;
  travelStartDate?: Date;
  partySize?: number;
  countryEntryDate?: Date;
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

/**
 * Hallazgo ALTO de revalidacion PR#7 ("aislamiento de cliente y vehiculo
 * incompleto"): se expone `operatingCompanyId` para que los handlers
 * comparen organizacion Y empresa, no solo organizacion.
 */
export interface CustomerRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
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
}
