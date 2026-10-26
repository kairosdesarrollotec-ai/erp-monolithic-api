import type { RecordZoneMarksResult } from '../../application/commands/record-zone-marks.handler';
import type { ReturnZoneMarksResponse } from './dto/return.response';
import {
  ImmobilizationChargeRecord,
  ReturnDamageRecord,
  ReturnEvidenceRecord,
  ReturnRecord,
  ReturnReminderRecord,
} from '../../application/ports/return-repository.port';
import type { ReminderInboxItem } from '../../application/ports/return-reminder-repository.port';
import type { ReturnAlertItem } from '../../application/queries/list-return-alerts.handler';
import type { ImmobilizationAlert, ReturnAlerts, WarrantyReleaseAlert } from '../../domain/return-alerts';
import { CosmeticTariffItem } from '../../domain/cosmetic-damage-rate';
import { CustomerRiskStatus } from '../../domain/customer-risk-status';
import {
  AlcoholEscalationResponse,
  ManualLateChargeResponse,
  CosmeticTariffResponse,
  ResponsibilityDocumentResponse,
  ImmobilizationChargeResponse,
  ReturnDamageResponse,
  ReturnEvidenceResponse,
  ReturnResponse,
  ReturnAlertItemResponse,
  ReturnAlertsResponse,
  ReturnLatenessChargeResponse,
  ReturnLatenessResponse,
  ReturnReminderInboxItemResponse,
  ReturnReminderResponse,
  ImmobilizationAlertResponse,
  WarrantyReleaseAlertResponse,
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

function toManualLateChargeResponse(record: ReturnRecord): ManualLateChargeResponse | null {
  if (record.lateChargeAmount === null || record.lateChargeAmount === undefined) return null;
  return {
    amount: record.lateChargeAmount,
    notes: record.lateChargeNotes ?? null,
    registeredById: record.lateChargeRegisteredById ?? '',
    registeredAt: record.lateChargeRegisteredAt ? record.lateChargeRegisteredAt.toISOString() : '',
  };
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

export function toReturnReminderResponse(record: ReturnReminderRecord): ReturnReminderResponse {
  return {
    id: record.id,
    status: record.status,
    dueAt: record.dueAt.toISOString(),
    text: record.messageText,
    generatedAt: record.generatedAt.toISOString(),
    sentAt: record.sentAt ? record.sentAt.toISOString() : null,
    sentBy: record.sentBy,
    note: record.resultNote,
    attempts: record.attempts,
    version: record.version,
    etag: `"${record.version}"`,
  };
}

export function toReminderInboxItemResponse(item: ReminderInboxItem): ReturnReminderInboxItemResponse {
  return {
    returnId: item.returnId,
    rentalId: item.rentalId,
    returnStatus: item.returnStatus as ReturnReminderInboxItemResponse['returnStatus'],
    scheduledAt: item.scheduledAt.toISOString(),
    vehiclePlate: item.vehiclePlate,
    customerName: item.customerName,
    customerPhone: item.customerPhone,
    reminder: toReturnReminderResponse(item.reminder),
  };
}

function toWarrantyReleaseAlertResponse(alert: WarrantyReleaseAlert): WarrantyReleaseAlertResponse {
  return {
    level: alert.level,
    deadlineAt: alert.deadlineAt.toISOString(),
    hoursRemaining: Math.round(alert.hoursRemaining * 100) / 100,
  };
}

function toImmobilizationAlertResponse(alert: ImmobilizationAlert): ImmobilizationAlertResponse {
  return {
    since: alert.since.toISOString(),
    hoursElapsed: Math.round(alert.hoursElapsed * 100) / 100,
    pendingDays: alert.pendingDays,
    dailyRate: alert.dailyRate,
    suggestedAmount: alert.suggestedAmount,
  };
}

export function toReturnAlertsResponse(alerts: ReturnAlerts): ReturnAlertsResponse {
  return {
    warrantyRelease: alerts.warrantyRelease ? toWarrantyReleaseAlertResponse(alerts.warrantyRelease) : null,
    immobilization: alerts.immobilization ? toImmobilizationAlertResponse(alerts.immobilization) : null,
  };
}

export function toReturnAlertItemResponse(item: ReturnAlertItem): ReturnAlertItemResponse {
  return {
    type: item.type,
    returnId: item.returnId,
    rentalId: item.rentalId,
    returnStatus: item.returnStatus as ReturnAlertItemResponse['returnStatus'],
    returnVersion: item.returnVersion,
    vehiclePlate: item.vehiclePlate,
    customerName: item.customerName,
    receivedAt: item.receivedAt.toISOString(),
    warrantyRelease: item.warrantyRelease ? toWarrantyReleaseAlertResponse(item.warrantyRelease) : null,
    immobilization: item.immobilization ? toImmobilizationAlertResponse(item.immobilization) : null,
    lateCharge: item.lateCharge ? { lateMinutes: item.lateCharge.lateMinutes, lateToleranceMinutes: item.lateCharge.lateToleranceMinutes } : null,
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
    depositRequired: record.depositRequired ?? true,
    status: record.status,
    custodyHolder: record.custodyHolder,
    customerPresent: record.customerPresent,
    mileageAtReturn: record.mileageAtReturn,
    fuelLevelAtReturn: record.fuelLevelAtReturn,
    alcoholTestResult: record.alcoholTestResult,
    alcoholTestNotes: record.alcoholTestNotes,
    alcoholEscalation: toAlcoholEscalationResponse(record),
    manualLateCharge: toManualLateChargeResponse(record),
    responsibilityDocument: toResponsibilityDocumentResponse(record),
    reminder: record.reminder ? toReturnReminderResponse(record.reminder) : null,
    ...(record.alerts ? { alerts: toReturnAlertsResponse(record.alerts) } : {}),
    ...(record.lateness !== undefined ? { lateness: record.lateness as ReturnLatenessResponse | null } : {}),
    ...(record.latenessCharge !== undefined ? { latenessCharge: record.latenessCharge as ReturnLatenessChargeResponse | null } : {}),
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
    mechanicReportAccepted: record.mechanicReportAccepted ?? false,
    mechanicReportAcceptedAt: record.mechanicReportAcceptedAt ? record.mechanicReportAcceptedAt.toISOString() : null,
    mechanicReportAcceptedBy: record.mechanicReportAcceptedBy ?? null,
    mechanicReportNotes: record.mechanicReportNotes ?? null,
    legalEscalated: record.legalEscalated ?? false,
    legalEscalatedAt: record.legalEscalatedAt ? record.legalEscalatedAt.toISOString() : null,
    legalEscalatedBy: record.legalEscalatedBy ?? null,
    legalNotes: record.legalNotes ?? null,
    holderNotification: record.responsibilitySignerIsHolder === false ? {
      sent: Boolean(record.holderNotificationSent),
      sentAt: record.holderNotificationSentAt ? record.holderNotificationSentAt.toISOString() : null,
      sentBy: record.holderNotificationSentBy ?? null,
      channel: record.holderNotificationChannel ?? null,
      observations: record.holderNotificationNotes ?? null,
      pending: !record.holderNotificationSent,
    } : null,
  };
}

export function toReturnZoneMarksResponse(result: RecordZoneMarksResult): ReturnZoneMarksResponse {
  return {
    returnId: result.returnId,
    marks: result.marks.map((m) => ({ zone: m.zone, mark: m.mark, markedBy: m.markedBy, markedAt: m.markedAt.toISOString() })),
    complete: result.complete,
    route: result.route,
  };
}
