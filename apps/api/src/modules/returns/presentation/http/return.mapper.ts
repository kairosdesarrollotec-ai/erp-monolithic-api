import {
  ImmobilizationChargeRecord,
  ReturnDamageRecord,
  ReturnEvidenceRecord,
  ReturnRecord,
} from '../../application/ports/return-repository.port';
import { CosmeticTariffItem } from '../../domain/cosmetic-damage-rate';
import { CustomerRiskStatus } from '../../domain/customer-risk-status';
import {
  AlcoholEscalationResponse,
  CosmeticTariffResponse,
  ResponsibilityDocumentResponse,
  ImmobilizationChargeResponse,
  ReturnDamageResponse,
  ReturnEvidenceResponse,
  ReturnResponse,
} from './dto/return.response';

export function toReturnDamageResponse(
  record: ReturnDamageRecord,
  rentalReturn?: Pick<ReturnRecord, 'version'>,
  customerRiskStatus?: CustomerRiskStatus,
): ReturnDamageResponse {
  return {
    id: record.id,
    returnId: record.returnId,
    origin: record.origin,
    severity: record.severity,
    damagedZone: record.damagedZone,
    estimatedAmount: record.estimatedAmount,
    externalReportReference: record.externalReportReference,
    description: record.description,
    createdAt: record.createdAt.toISOString(),
    ...(rentalReturn ? { returnVersion: rentalReturn.version, returnEtag: `"${rentalReturn.version}"` } : {}),
    ...(customerRiskStatus ? { customerRiskStatus } : {}),
  };
}

export function toImmobilizationChargeResponse(
  record: ImmobilizationChargeRecord,
  rentalReturn?: Pick<ReturnRecord, 'version'>,
): ImmobilizationChargeResponse {
  return {
    id: record.id,
    returnId: record.returnId,
    damageId: record.damageId,
    daysCharged: record.daysCharged,
    dailyRate: record.dailyRate,
    totalAmount: record.totalAmount,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
    ...(rentalReturn ? { returnVersion: rentalReturn.version, returnEtag: `"${rentalReturn.version}"` } : {}),
  };
}

export function toReturnEvidenceResponse(record: ReturnEvidenceRecord): ReturnEvidenceResponse {
  return {
    id: record.id,
    returnId: record.returnId,
    type: record.type,
    zone: record.zone,
    objectUrl: record.objectUrl,
    createdAt: record.uploadedAt.toISOString(),
  };
}

export function toCosmeticTariffResponse(items: readonly CosmeticTariffItem[]): CosmeticTariffResponse {
  return { items: items.map((i) => ({ code: i.code, name: i.name, pricePen: i.pricePen })) };
}

function toAlcoholEscalationResponse(record: ReturnRecord): AlcoholEscalationResponse | null {
  if (!record.alcoholEscalationDecision) return null;
  return {
    decision: record.alcoholEscalationDecision,
    markCustomerRed: record.alcoholEscalationMarkedRed ?? false,
    notes: record.alcoholEscalationNotes ?? '',
    decidedById: record.alcoholEscalationDecidedById ?? '',
    decidedAt: record.alcoholEscalationDecidedAt ? record.alcoholEscalationDecidedAt.toISOString() : '',
  };
}

function toResponsibilityDocumentResponse(record: ReturnRecord): ResponsibilityDocumentResponse | null {
  if (!record.responsibilitySignerName || !record.responsibilitySignedAt) return null;
  return {
    signerName: record.responsibilitySignerName,
    signerIsHolder: record.responsibilitySignerIsHolder ?? true,
    signerRelationToHolder: record.responsibilitySignerRelation,
    signedAt: record.responsibilitySignedAt.toISOString(),
  };
}

export function toReturnResponse(record: ReturnRecord): ReturnResponse {
  return {
    id: record.id,
    organizationId: record.organizationId,
    operatingCompanyId: record.operatingCompanyId,
    branchId: record.branchId,
    rentalId: record.rentalId,
    vehicleId: record.vehicleId,
    customerId: record.customerId,
    vehiclePlate: record.vehiclePlate,
    customerName: record.customerName,
    status: record.status,
    custodyHolder: record.custodyHolder,
    customerPresent: record.customerPresent,
    mileageAtReturn: record.mileageAtReturn,
    fuelLevelAtReturn: record.fuelLevelAtReturn,
    alcoholTestResult: record.alcoholTestResult,
    alcoholTestNotes: record.alcoholTestNotes,
    alcoholEscalation: toAlcoholEscalationResponse(record),
    responsibilityDocument: toResponsibilityDocumentResponse(record),
    scheduledAt: record.scheduledAt.toISOString(),
    receivedAt: record.receivedAt ? record.receivedAt.toISOString() : null,
    inspectedAt: record.inspectedAt ? record.inspectedAt.toISOString() : null,
    closedAt: record.closedAt ? record.closedAt.toISOString() : null,
    finalSettlementAmount: record.finalSettlementAmount,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    updatedAt: record.updatedAt.toISOString(),
    updatedBy: record.updatedBy,
    version: record.version,
    etag: `"${record.version}"`,
    damages: (record.damages ?? []).map((d) => toReturnDamageResponse(d)),
    immobilizationCharges: (record.immobilizationCharges ?? []).map((c) => toImmobilizationChargeResponse(c)),
  };
}
