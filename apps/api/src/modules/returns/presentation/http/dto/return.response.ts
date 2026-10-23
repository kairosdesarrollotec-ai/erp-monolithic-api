import { ReturnReminderStatus } from '../../../domain/return-reminder';
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

/** BR-DEV-004 / DAT-DEV-001: recordatorio previo (envío manual-asistido por WhatsApp). */
export interface ReturnReminderResponse {
  id: string;
  status: ReturnReminderStatus;
  /** Hora pactada - 3 h. */
  dueAt: string;
  /** Texto generado por el sistema, listo para copiar/pegar en WhatsApp. */
  text: string;
  generatedAt: string;
  sentAt: string | null;
  sentBy: string | null;
  note: string | null;
  attempts: number;
  /** Versión del recordatorio = valor de If-Match de register-reminder. */
  version: number;
  etag: string;
}

export interface ReturnReminderInboxItemResponse {
  returnId: string;
  rentalId: string;
  returnStatus: ReturnStatus;
  scheduledAt: string;
  vehiclePlate: string | null;
  customerName: string | null;
  customerPhone: string | null;
  reminder: ReturnReminderResponse;
}

export interface WarrantyReleaseAlertResponse {
  level: 'DUE_SOON' | 'OVERDUE';
  deadlineAt: string;
  hoursRemaining: number;
}

export interface ImmobilizationAlertResponse {
  since: string;
  hoursElapsed: number;
  pendingDays: number;
  dailyRate: number | null;
  suggestedAmount: number | null;
}

export interface ReturnAlertsResponse {
  warrantyRelease: WarrantyReleaseAlertResponse | null;
  immobilization: ImmobilizationAlertResponse | null;
}

/** DEC-DEVREM-003: sugerencia de registrar el cargo por retraso manual (sin monto). */
export interface LateChargeSuggestionResponse {
  lateMinutes: number;
  lateToleranceMinutes: number;
}

export interface ReturnAlertItemResponse {
  type: 'WARRANTY_RELEASE' | 'IMMOBILIZATION' | 'LATE_CHARGE';
  returnId: string;
  rentalId: string;
  returnStatus: ReturnStatus;
  returnVersion: number;
  vehiclePlate: string | null;
  customerName: string | null;
  receivedAt: string;
  warrantyRelease: WarrantyReleaseAlertResponse | null;
  immobilization: ImmobilizationAlertResponse | null;
  lateCharge: LateChargeSuggestionResponse | null;
}

export interface AlcoholEscalationResponse {
  decision: AlcoholEscalationDecision;
  markCustomerRed: boolean;
  notes: string;
  decidedById: string;
  decidedAt: string;
}

/** DEC-DEV-LATE-CHARGE-002: cargo por retraso registrado MANUALMENTE (monto digitado, sin cálculo automático). */
export interface ManualLateChargeResponse {
  amount: number;
  notes: string | null;
  registeredById: string;
  registeredAt: string;
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

export interface ReturnLatenessResponse {
  lateToleranceMinutes: number;
  lateMinutes: number;
  isLate: boolean;
  basis: 'RECEIVED' | 'NOW';
}

export interface ReturnLatenessChargeResponse {
  tier: 'NONE' | 'EXTRA_31_120' | 'EXTRA_121_300' | 'EXTRA_OVER_300';
  basis: 'RECEIVED' | 'NOW';
  informational: true;
  timeChargePercent: number;
  guaranteePenaltyPercent: number;
  dailyRate: string | null;
  guaranteeAmount: string | null;
  currency: string | null;
  suggestedTimeCharge: string | null;
  suggestedGuaranteePenalty: string | null;
  noticeAndPrepaymentVerified: boolean | null;
  severeBreach: boolean;
  severeBreachThresholdHours: number;
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
  /** false = alquiler con conductor de la empresa: sin garantia; liberacion/devolucion de garantia N/A (sin alerta de 24 h). */
  depositRequired: boolean;
  status: ReturnStatus;
  custodyHolder: CustodyHolder;
  customerPresent: boolean;
  mileageAtReturn: number | null;
  fuelLevelAtReturn: ReturnFuelLevel | null;
  alcoholTestResult: AlcoholTestResult | null;
  alcoholTestNotes: string | null;
  alcoholEscalation: AlcoholEscalationResponse | null;
  /** Cargo por retraso manual (null = sin registrar). */
  manualLateCharge: ManualLateChargeResponse | null;
  responsibilityDocument: ResponsibilityDocumentResponse | null;
  /** Recordatorio previo 3 h antes de la hora pactada (null = aún no generado). */
  reminder: ReturnReminderResponse | null;
  /** Alertas operativas; solo en GET detalle y bandeja (las respuestas de comandos las omiten). */
  alerts?: ReturnAlertsResponse;
  /** BR-DEV-003: retraso con tolerancia de 30 min. Solo en GET /returns/{id} y GET /returns. */
  lateness?: ReturnLatenessResponse | null;
  /** DEC-DEV-LATE-CHARGE-001: cargo sugerido por retraso (informativo). Solo en GET /returns/{id} y GET /returns. */
  latenessCharge?: ReturnLatenessChargeResponse | null;
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

/** DEV-05 / PD-07: marcas por zona persistidas + ruta resultante. */
export interface ReturnZoneMarkResponse {
  zone: string;
  mark: 'NO_DAMAGE' | 'DAMAGE';
  markedBy: string;
  markedAt: string;
}

export interface ReturnZoneMarksResponse {
  returnId: string;
  marks: ReturnZoneMarkResponse[];
  /** true = las 5 zonas tienen marca. */
  complete: boolean;
  /** NO_DAMAGE = las 5 zonas sin daño (ir a DEV-09); DAMAGE = al menos una con daño (ir a DEV-06); null = faltan zonas. */
  route: 'NO_DAMAGE' | 'DAMAGE' | null;
}
