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
  isDirtRoad?: boolean;
  dataOrigin: InquiryDataOrigin;
  closedReason: string | null;
  version: number;
  createdAt: string;
}

/** Detalle de una consulta (CON-04) - resumen + historial. */
export interface InquiryResponse extends InquirySummaryResponse {
  /**
   * BR-CON-004 / CON-P06: documentos que se informan al cliente segun su
   * nacionalidad (peruano: recibo de agua o luz; extranjero: constancia de
   * hospedaje). Vacio si el cliente no tiene nacionalidad registrada.
   * Solo informativo: Consulta no recibe documentos.
   */
  requiredDocuments: { code: 'DNI' | 'PASAPORTE_O_CE' | 'LICENCIA_CONDUCIR' | 'RECIBO_AGUA_O_LUZ' | 'CONSTANCIA_HOSPEDAJE'; label: string }[];
  /** Id de la cotizacion mas reciente (la vigente si `validUntil` es futuro); null si no hay. Evita depender del orden de `quotations`. */
  latestQuotationId: string | null;
  /** Cronologico ascendente (la ultima es la mas reciente). */
  interactions: {
    id: string;
    channel: InquiryChannel;
    occurredAt: string;
    outcome: string | null;
    note: string | null;
  }[];
  /** De la MAS RECIENTE a la mas antigua: `quotations[0]` es la ultima. */
  quotations: {
    id: string;
    vehicleId: string;
    rateCardVersionId: string;
    destination: string;
    estimatedDays: number;
    amount: string;
    currency: string;
    plan?: string | null;
    validUntil: string;
    createdAt: string;
  }[];
}
