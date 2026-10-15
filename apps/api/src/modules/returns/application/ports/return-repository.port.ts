import type { Prisma } from '@prisma/client';
import {
  ReturnStatus,
  CustodyHolder,
  DamageOrigin,
  DamageSeverity,
  ReturnFuelLevel,
  AlcoholTestResult,
  AlcoholEscalationDecision,
  ReturnEvidenceType,
} from '../../domain/return-status';
import type { ReturnReminderStatus } from '../../domain/return-reminder';
import type { ReturnAlerts } from '../../domain/return-alerts';
import type { ReturnLateness } from '../../domain/return-lateness';

export interface ReturnScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export interface ReturnDamageRecord {
  id: string;
  returnId: string;
  origin: DamageOrigin;
  severity: DamageSeverity;
  damagedZone: string | null;
  estimatedAmount: number | null;
  externalReportReference: string | null;
  description: string | null;
  createdAt: Date;
}

export interface ImmobilizationChargeRecord {
  id: string;
  returnId: string;
  damageId: string | null;
  daysCharged: number;
  dailyRate: number;
  totalAmount: number;
  notes: string | null;
  createdAt: Date;
}

export interface ReturnEvidenceRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  returnId: string;
  type: ReturnEvidenceType;
  zone: string;
  objectUrl: string;
  uploadedBy: string;
  uploadedAt: Date;
}

/** DEV-01 / BR-DEV-004: recordatorio previo 3 h antes de la hora pactada (envío manual-asistido). */
export interface ReturnReminderRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  returnId: string;
  status: ReturnReminderStatus;
  dueAt: Date;
  messageText: string;
  generatedAt: Date;
  sentAt: Date | null;
  sentBy: string | null;
  resultNote: string | null;
  attempts: number;
  version: number;
}

export interface ReturnRecord {
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
  /** PROP-014: decisión provisional de Gerencia ante alcolímetro desfavorable (null = sin resolver). */
  alcoholEscalationDecision: AlcoholEscalationDecision | null;
  alcoholEscalationMarkedRed: boolean | null;
  alcoholEscalationNotes: string | null;
  alcoholEscalationDecidedById: string | null;
  alcoholEscalationDecidedAt: Date | null;
  /** BR-DEV-009 / DAT-DEV-005: documento de responsabilidad firmado al completar la inspección. */
  responsibilitySignerName: string | null;
  responsibilitySignerIsHolder: boolean | null;
  responsibilitySignerRelation: string | null;
  responsibilitySignatureData: string | null;
  responsibilitySignedAt: Date | null;
  /** dailyRate vigente del vehículo del alquiler (TDD §9.3); null si el vehículo no tiene tarifa. */
  vehicleDailyRate: number | null;
  /** DEC-ALQ-COMPANY-DRIVER-004: false = alquiler con conductor de la empresa, sin garantia (liberacion/devolucion N/A). Default true. */
  depositRequired?: boolean;
  scheduledAt: Date;
  receivedAt: Date | null;
  inspectedAt: Date | null;
  closedAt: Date | null;
  finalSettlementAmount: number | null;
  notes: string | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
  damages?: ReturnDamageRecord[];
  immobilizationCharges?: ImmobilizationChargeRecord[];
  evidences?: ReturnEvidenceRecord[];
  /** Recordatorio previo (null = aún no generado). Lo carga el repositorio junto con el agregado. */
  reminder?: ReturnReminderRecord | null;
  /** Alertas calculadas con el reloj (garantía 24 h / inmovilización > 24 h); solo las pueblan las consultas. */
  alerts?: ReturnAlerts;
  /** Retraso frente a la hora pactada con tolerancia de 30 min (BR-DEV-003); solo lo pueblan las consultas. null = no aplica. */
  lateness?: ReturnLateness | null;
}

export interface CreateReturnInput {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  rentalId: string;
  vehicleId: string;
  customerId: string;
  scheduledAt: Date;
  status?: ReturnStatus;
  custodyHolder?: CustodyHolder;
  customerPresent?: boolean;
  mileageAtReturn?: number;
  fuelLevelAtReturn?: ReturnFuelLevel;
  receivedAt?: Date;
  notes?: string;
  createdBy: string;
}

export interface UpdateReturnInput {
  id: string;
  scope: ReturnScope;
  expectedVersion: number;
  status?: ReturnStatus;
  custodyHolder?: CustodyHolder;
  customerPresent?: boolean;
  mileageAtReturn?: number;
  fuelLevelAtReturn?: ReturnFuelLevel;
  alcoholTestResult?: AlcoholTestResult;
  alcoholTestNotes?: string;
  alcoholEscalationDecision?: AlcoholEscalationDecision;
  alcoholEscalationMarkedRed?: boolean;
  alcoholEscalationNotes?: string;
  alcoholEscalationDecidedById?: string;
  alcoholEscalationDecidedAt?: Date;
  responsibilitySignerName?: string;
  responsibilitySignerIsHolder?: boolean;
  responsibilitySignerRelation?: string;
  responsibilitySignatureData?: string;
  responsibilitySignedAt?: Date;
  receivedAt?: Date;
  inspectedAt?: Date;
  closedAt?: Date;
  finalSettlementAmount?: number;
  notes?: string;
  updatedBy: string;
}

export interface ListReturnsFilter extends ReturnScope {
  status?: ReturnStatus;
  cursor?: { createdAt: Date; id: string };
  limit: number;
}

export interface AddDamageInput {
  returnId: string;
  origin: DamageOrigin;
  severity: DamageSeverity;
  damagedZone?: string;
  estimatedAmount?: number;
  externalReportReference?: string;
  description?: string;
}

export interface AddImmobilizationChargeInput {
  returnId: string;
  damageId?: string;
  daysCharged: number;
  dailyRate: number;
  totalAmount: number;
  notes?: string;
}

export interface AddEvidenceInput {
  organizationId: string;
  operatingCompanyId: string;
  returnId: string;
  type: ReturnEvidenceType;
  zone: string;
  objectUrl: string;
  uploadedBy: string;
}

export interface ReturnEvidenceCounts {
  photos: number;
  videos: number;
}

export abstract class ReturnRepositoryPort {
  abstract create(input: CreateReturnInput, tx?: Prisma.TransactionClient): Promise<ReturnRecord>;
  abstract findById(id: string, scope: ReturnScope, tx?: Prisma.TransactionClient): Promise<ReturnRecord | null>;
  abstract findByRentalId(rentalId: string, scope: ReturnScope, tx?: Prisma.TransactionClient): Promise<ReturnRecord | null>;
  abstract update(input: UpdateReturnInput, tx?: Prisma.TransactionClient): Promise<ReturnRecord>;
  abstract list(filter: ListReturnsFilter): Promise<ReturnRecord[]>;
  abstract addDamage(input: AddDamageInput, tx?: Prisma.TransactionClient): Promise<ReturnDamageRecord>;
  abstract addImmobilizationCharge(input: AddImmobilizationChargeInput, tx?: Prisma.TransactionClient): Promise<ImmobilizationChargeRecord>;
  abstract addEvidence(input: AddEvidenceInput, tx?: Prisma.TransactionClient): Promise<ReturnEvidenceRecord>;
  abstract listEvidences(returnId: string, scope: ReturnScope): Promise<ReturnEvidenceRecord[]>;
  abstract countEvidenceByType(
    returnId: string,
    scope: ReturnScope,
    tx?: Prisma.TransactionClient,
  ): Promise<ReturnEvidenceCounts>;
}
