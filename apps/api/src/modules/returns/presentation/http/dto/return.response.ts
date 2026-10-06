import { CustomerRiskStatus } from '../../../domain/customer-risk-status';
import {
  AlcoholEscalationDecision,
  AlcoholTestResult,
  CustodyHolder,
  DamageOrigin,
  DamageSeverity,
  ReturnEvidenceType,
  ReturnFuelLevel,
  ReturnStatus,
} from '../../../domain/return-status';

export interface ReturnDamageResponse {
  id: string;
  returnId: string;
  origin: DamageOrigin;
  severity: DamageSeverity;
  damagedZone: string | null;
  estimatedAmount: number | null;
  externalReportReference: string | null;
  description: string | null;
  createdAt: string;
  /** Versión/etag del expediente tras el comando (para el siguiente If-Match). Solo en assess-damage. */
  returnVersion?: number;
  returnEtag?: string;
  /** Semáforo del cliente resultante (NORMAL|AMBAR|ROJO, solo avanza). Solo en assess-damage. */
  customerRiskStatus?: CustomerRiskStatus;
}

export interface ImmobilizationChargeResponse {
  id: string;
  returnId: string;
  damageId: string | null;
  daysCharged: number;
  dailyRate: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  /** Versión/etag del expediente tras el comando (para el siguiente If-Match). Solo en charge-immobilization. */
  returnVersion?: number;
  returnEtag?: string;
}

export interface AlcoholEscalationResponse {
  decision: AlcoholEscalationDecision;
  markCustomerRed: boolean;
  notes: string;
  decidedById: string;
  decidedAt: string;
}

/** Nunca incluye signatureData (dato sensible de firma). */
export interface ResponsibilityDocumentResponse {
  signerName: string;
  signerIsHolder: boolean;
  signerRelationToHolder: string | null;
  signedAt: string;
}

export interface CosmeticTariffItemResponse {
  code: string;
  name: string;
  pricePen: number;
}

export interface CosmeticTariffResponse {
  items: CosmeticTariffItemResponse[];
}

export interface ReturnResponse {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  rentalId: string;
  vehicleId: string;
  customerId: string;
  vehiclePlate: string | null;
  customerName: string | null;
  status: ReturnStatus;
  custodyHolder: CustodyHolder;
  customerPresent: boolean;
  mileageAtReturn: number | null;
  fuelLevelAtReturn: ReturnFuelLevel | null;
  alcoholTestResult: AlcoholTestResult | null;
  alcoholTestNotes: string | null;
  alcoholEscalation: AlcoholEscalationResponse | null;
  responsibilityDocument: ResponsibilityDocumentResponse | null;
  scheduledAt: string;
  receivedAt: string | null;
  inspectedAt: string | null;
  closedAt: string | null;
  finalSettlementAmount: number | null;
  notes: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
  etag: string;
  damages: ReturnDamageResponse[];
  immobilizationCharges: ImmobilizationChargeResponse[];
}

export interface ReturnEvidenceResponse {
  id: string;
  returnId: string;
  type: ReturnEvidenceType;
  zone: string;
  objectUrl: string;
  createdAt: string;
}

export interface ReturnEvidenceUploadSessionResponse {
  uploadUrl: string;
  objectUrl: string;
  expiresAt: string;
}
