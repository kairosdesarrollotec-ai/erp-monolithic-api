import { InquiryStatus } from '../../../domain/inquiry-status';
import { InquiryChannel } from '../../../domain/inquiry-channel';
import { InquiryDataOrigin } from '../../../domain/inquiry-data-origin';

/**
 * Resumen de una consulta (CON-01, GET /inquiries).
 * CONFLICT-CON-002 (resuelto): los campos de identidad del prospecto
 * (nombre, documento, nacionalidad) ya no están en Inquiry. Para obtener
 * esa información, consultar GET /customers/{customerId}.
 */
export interface InquirySummaryResponse {
  id: string;
  companyId: string;
  branchId: string;
  status: InquiryStatus;
  /** null solo en consultas LEGACY_STUB (nunca se capturo). */
  channel: InquiryChannel | null;
  touristUse: boolean;
  customerId: string | null;
  destination: string | null;
  estimatedDays: number | null;
  travelStartDate: string | null;
  partySize: number | null;
  dataOrigin: InquiryDataOrigin;
  closedReason: string | null;
  version: number;
  createdAt: string;
}

/** Detalle de una consulta (CON-04) - resumen + historial. */
export interface InquiryResponse extends InquirySummaryResponse {
  interactions: {
    id: string;
    channel: InquiryChannel;
    occurredAt: string;
    outcome: string | null;
    note: string | null;
  }[];
  quotations: {
    id: string;
    vehicleId: string;
    rateCardVersionId: string;
    destination: string;
    estimatedDays: number;
    amount: string;
    currency: string;
    validUntil: string;
    createdAt: string;
  }[];
}
