import { RentalStatus } from '../../../domain/rental-status';
import { AlcoholTestResult } from '../../../domain/alcohol-test-result';
import { NotaryResult } from '../../../domain/notary-result';
import { RentalPartyRole } from '../../../domain/rental-party-role';

export interface RentalPartyResponse {
  id: string;
  customerId: string;
  role: RentalPartyRole;
  createdAt: string;
}

export interface NotaryEvaluationResponse {
  id: string;
  policyVersion: number;
  result: NotaryResult;
  reason: string;
  evaluatedAt: string;
  approvedBy: string | null;
  justification: string | null;
}

export interface RentalContractResponse {
  id: string;
  templateId?: string | null;
  documentRef: string;
  status: string;
  signedAt: string | null;
  /** BR-DOC-003: combinacion con la que se eligio la plantilla (null en contratos previos). */
  contractVariant: string | null;
  createdAt: string;
}

export interface RentalDepositResponse {
  id: string;
  /** Garantia TOTAL retenida (incluye el monto de reserva trasladado). */
  originalAmount: string;
  currency: string;
  status: string;
  /** P0-03 (a): parte de la garantia ya pagada como reserva ("0.00" si no aplica). */
  reservationCreditAmount: string;
  /** Diferencia cobrada al formalizar = originalAmount - reservationCreditAmount. */
  amountCollected: string;
  createdAt: string;
}

/** P0-03 (a): traslado reserva -> garantia (vista previa; solo origen Reserva). */
export interface ReservationCreditResponse {
  applicable: boolean;
  reason: 'APPLIED' | 'NO_RESERVATION' | 'RESERVATION_NOT_ACTIVE' | 'PAYMENT_NOT_VALIDATED';
  reservationId: string | null;
  amount: string;
  currency: string | null;
}

/** BR-ALQ-012/013: estado de los 4 requisitos de una ampliacion. */
export interface ExtensionRequirementsResponse {
  noticeGiven: boolean | null;
  authorized: boolean;
  paid: boolean;
  addendumSigned: boolean;
}

export interface RentalExtensionResponse {
  id: string;
  requestedEndAt: string;
  status: 'PENDING' | 'AUTHORIZED' | 'REJECTED' | 'BREACH';
  requestedAt: string;
  resolvedAt: string | null;
  paymentId: string | null;
  addendumDocumentRef: string | null;
  requirements: ExtensionRequirementsResponse;
}

export interface RentalResponse {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  inquiryId: string | null;
  reservationId: string | null;
  customerId: string;
  customerName: string;
  customerDocNumber: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleDepositMinimum: number | null;
  planCode: string;
  status: RentalStatus;
  startAt: string | null;
  expectedEndAt: string | null;
  alcoholTestResult: AlcoholTestResult | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
  etag: string;
  parties?: RentalPartyResponse[];
  notaryEvaluation?: NotaryEvaluationResponse | null;
  contract?: RentalContractResponse | null;
  deposit?: RentalDepositResponse | null;
  /** Presente solo en GET /rentals/{id}; null = alquiler sin reserva de origen. */
  reservationCredit?: ReservationCreditResponse | null;
  /** Solo en GET /rentals/{id}: ampliaciones, la mas reciente primero. */
  extensions?: RentalExtensionResponse[];
}
