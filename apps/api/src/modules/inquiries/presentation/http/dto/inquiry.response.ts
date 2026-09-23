import { InquiryStatus } from '../../../domain/inquiry-status';
import { InquiryChannel } from '../../../domain/inquiry-channel';
import { InquiryNationality, ThirdRequiredDocument } from '../../../domain/inquiry-nationality';
import { InquiryDataOrigin } from '../../../domain/inquiry-data-origin';

/**
 * Resumen de una consulta (CON-01, GET /inquiries). Incluye el snapshot de
 * CON-02 (revalidacion PR#7) para que la bandeja muestre cliente/prospecto,
 * canal, estado y fecha sin cargar el historial.
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
  prospectName: string | null;
  prospectDocumentType: string | null;
  prospectDocumentNumber: string | null;
  nationality: InquiryNationality | null;
  destination: string | null;
  estimatedDays: number | null;
  travelStartDate: string | null;
  partySize: number | null;
  countryEntryDate: string | null;
  /** BR-CON-004 - derivado de la nacionalidad; null si no se conoce. */
  thirdRequiredDocument: ThirdRequiredDocument | null;
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
