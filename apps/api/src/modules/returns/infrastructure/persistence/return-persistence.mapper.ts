import { Prisma } from '@prisma/client';
import {
  ImmobilizationChargeRecord,
  ReturnDamageRecord,
  ReturnEvidenceRecord,
  ReturnRecord,
  ReturnReminderRecord,
} from '../../application/ports/return-repository.port';

/**
 * Relaciones que siempre se cargan con el agregado Return. La evidencia NO se incluye (puede superar
 * 38 archivos por expediente): se consulta aparte con listEvidences.
 */
export const RETURN_INCLUDE = {
  vehicle: { select: { plate: true, dailyRate: true } },
  customer: { select: { fullName: true } },
  damages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  immobilizationCharges: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  reminder: true,
  /** DEC-ALQ-COMPANY-DRIVER-004: si el alquiler es con conductor de la empresa no hay garantia que liberar/devolver. */
  rental: { select: { contract: { select: { depositRequired: true } } } },
} satisfies Prisma.RentalReturnInclude;

export type ReturnWithRelations = Prisma.RentalReturnGetPayload<{ include: typeof RETURN_INCLUDE }>;

type ReturnDamageRow = Prisma.ReturnDamageGetPayload<Record<string, never>>;
type ImmobilizationChargeRow = Prisma.ImmobilizationChargeGetPayload<Record<string, never>>;
type ReturnEvidenceRow = Prisma.ReturnEvidenceGetPayload<Record<string, never>>;
export type ReturnReminderRow = Prisma.ReturnReminderGetPayload<Record<string, never>>;

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

export function toReturnDamageRecord(row: ReturnDamageRow): ReturnDamageRecord {
  return {
    id: row.id,
    returnId: row.returnId,
    origin: row.origin,
    severity: row.severity,
    damagedZone: row.damagedZone,
    estimatedAmount: decimalToNumber(row.estimatedAmount),
    externalReportReference: row.externalReportReference,
    description: row.description,
    createdAt: row.createdAt,
  };
}

export function toImmobilizationChargeRecord(row: ImmobilizationChargeRow): ImmobilizationChargeRecord {
  return {
    id: row.id,
    returnId: row.returnId,
    damageId: row.damageId,
    daysCharged: row.daysCharged,
    dailyRate: row.dailyRate.toNumber(),
    totalAmount: row.totalAmount.toNumber(),
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

export function toReturnEvidenceRecord(row: ReturnEvidenceRow): ReturnEvidenceRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    returnId: row.returnId,
    type: row.type,
    zone: row.zone,
    objectUrl: row.objectUrl,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt,
  };
}

export function toReturnReminderRecord(row: ReturnReminderRow): ReturnReminderRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    returnId: row.returnId,
    status: row.status,
    dueAt: row.dueAt,
    messageText: row.messageText,
    generatedAt: row.generatedAt,
    sentAt: row.sentAt,
    sentBy: row.sentBy,
    resultNote: row.resultNote,
    attempts: row.attempts,
    version: row.version,
  };
}

export function toReturnRecord(row: ReturnWithRelations): ReturnRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    rentalId: row.rentalId,
    vehicleId: row.vehicleId,
    customerId: row.customerId,
    vehiclePlate: row.vehicle.plate,
    customerName: row.customer.fullName,
    status: row.status,
    custodyHolder: row.custodyHolder,
    customerPresent: row.customerPresent,
    mileageAtReturn: row.mileageAtReturn,
    fuelLevelAtReturn: row.fuelLevelAtReturn,
    alcoholTestResult: row.alcoholTestResult,
    alcoholTestNotes: row.alcoholTestNotes,
    alcoholEscalationDecision: row.alcoholEscalationDecision,
    alcoholEscalationMarkedRed: row.alcoholEscalationMarkedRed,
    alcoholEscalationNotes: row.alcoholEscalationNotes,
    alcoholEscalationDecidedById: row.alcoholEscalationDecidedById,
    alcoholEscalationDecidedAt: row.alcoholEscalationDecidedAt,
    responsibilitySignerName: row.responsibilitySignerName,
    responsibilitySignerIsHolder: row.responsibilitySignerIsHolder,
    responsibilitySignerRelation: row.responsibilitySignerRelation,
    responsibilitySignatureData: row.responsibilitySignatureData,
    responsibilitySignedAt: row.responsibilitySignedAt,
    vehicleDailyRate: decimalToNumber(row.vehicle.dailyRate),
    depositRequired: row.rental?.contract?.depositRequired ?? true,
    scheduledAt: row.scheduledAt,
    receivedAt: row.receivedAt,
    inspectedAt: row.inspectedAt,
    closedAt: row.closedAt,
    finalSettlementAmount: decimalToNumber(row.finalSettlementAmount),
    notes: row.notes,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    version: row.version,
    damages: row.damages.map(toReturnDamageRecord),
    immobilizationCharges: row.immobilizationCharges.map(toImmobilizationChargeRecord),
    reminder: row.reminder ? toReturnReminderRecord(row.reminder) : null,
  };
}
