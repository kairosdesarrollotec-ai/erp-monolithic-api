import { Prisma } from '@prisma/client';
import {
  RentalRecord,
  RentalPartyRecord,
  NotaryEvaluationRecord,
  RentalContractRecord,
  RentalDepositRecord,
  RentalExtensionRecord,
} from '../../application/ports/rental-repository.port';
import { RentalStatus } from '../../domain/rental-status';
import { ExtensionStatus } from '../../domain/extension-status';
import { RentalPartyRole } from '../../domain/rental-party-role';
import { NotaryResult } from '../../domain/notary-result';

export type RentalWithRelations = Prisma.RentalGetPayload<{
  include: {
    customer: true;
    vehicle: true;
    parties: true;
    notaryEvaluation: true;
    contract: true;
    deposit: true;
  };
}>;

export function toRentalPartyRecord(p: {
  id: string;
  rentalId: string;
  customerId: string;
  role: string;
  createdAt: Date;
}): RentalPartyRecord {
  return {
    id: p.id,
    rentalId: p.rentalId,
    customerId: p.customerId,
    role: p.role as RentalPartyRole,
    createdAt: p.createdAt,
  };
}

export function toNotaryEvaluationRecord(row: {
  id: string;
  rentalId: string;
  policyVersion: number;
  result: string;
  reason: string;
  evaluatedAt: Date;
  approvedBy: string | null;
  justification: string | null;
} | null): NotaryEvaluationRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    rentalId: row.rentalId,
    policyVersion: row.policyVersion,
    result: row.result as NotaryResult,
    reason: row.reason,
    evaluatedAt: row.evaluatedAt,
    approvedBy: row.approvedBy,
    justification: row.justification,
  };
}

export function toRentalContractRecord(row: {
  id: string;
  rentalId: string;
  templateVersionId: string | null;
  templateId: string | null;
  documentRef: string;
  status: string;
  signedAt: Date | null;
  createdAt: Date;
} | null): RentalContractRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    rentalId: row.rentalId,
    templateVersionId: row.templateVersionId,
    templateId: row.templateId,
    documentRef: row.documentRef,
    status: row.status,
    signedAt: row.signedAt,
    createdAt: row.createdAt,
  };
}

export function toRentalDepositRecord(row: {
  id: string;
  rentalId: string;
  originalAmount: Prisma.Decimal | string;
  currency: string;
  status: string;
  createdAt: Date;
} | null): RentalDepositRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    rentalId: row.rentalId,
    originalAmount: row.originalAmount.toString(),
    currency: row.currency,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function toRentalRecord(row: RentalWithRelations): RentalRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    inquiryId: row.inquiryId,
    reservationId: row.reservationId,
    customerId: row.customerId,
    customerName: row.customer.fullName,
    customerDocNumber: row.customer.documentNumber,
    vehicleId: row.vehicleId,
    vehiclePlate: row.vehicle.plate,
    vehicleBrand: row.vehicle.brand,
    vehicleModel: row.vehicle.model,
    vehicleDepositMinimum: row.vehicle.depositMinimum != null ? Number(row.vehicle.depositMinimum) : null,
    planCode: row.planCode,
    status: row.status as RentalStatus,
    startAt: row.startAt,
    expectedEndAt: row.expectedEndAt,
    alcoholTestResult: row.alcoholTestResult,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    version: row.version,
    parties: row.parties.map(toRentalPartyRecord),
    notaryEvaluation: toNotaryEvaluationRecord(row.notaryEvaluation),
    contract: toRentalContractRecord(row.contract),
    deposit: toRentalDepositRecord(row.deposit),
  };
}

export function toRentalExtensionRecord(row: {
  id: string;
  rentalId: string;
  requestedEndAt: Date;
  status: string;
  paymentId: string | null;
  addendumDocumentRef: string | null;
  requestedAt: Date;
  resolvedAt: Date | null;
}): RentalExtensionRecord {
  return {
    id: row.id,
    rentalId: row.rentalId,
    requestedEndAt: row.requestedEndAt,
    status: row.status as ExtensionStatus,
    paymentId: row.paymentId,
    addendumDocumentRef: row.addendumDocumentRef,
    requestedAt: row.requestedAt,
    resolvedAt: row.resolvedAt,
  };
}
