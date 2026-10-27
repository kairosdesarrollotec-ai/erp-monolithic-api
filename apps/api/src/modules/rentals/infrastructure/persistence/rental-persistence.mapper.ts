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
  addendumDocumentRef?: string | null;
  createdAt: Date;
}): RentalPartyRecord {
  return {
    id: p.id,
    rentalId: p.rentalId,
    customerId: p.customerId,
    role: p.role as RentalPartyRole,
    addendumDocumentRef: p.addendumDocumentRef ?? null,
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
  biometricVerified?: boolean;
  biometricVerifiedBy?: string | null;
  previousRentalsCount?: number | null;
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
    biometricVerified: row.biometricVerified ?? false,
    biometricVerifiedBy: row.biometricVerifiedBy ?? null,
    previousRentalsCount: row.previousRentalsCount ?? null,
  };
}

export function toRentalContractRecord(row: {
  id: string;
  rentalId: string;
  templateId: string | null;
  documentRef: string;
  status: string;
  signedAt: Date | null;
  contractVariant?: string | null;
  depositRequired?: boolean;
  reservationCreditExcess?: Prisma.Decimal | string;
  fingerprintTaken?: boolean;
  fingerprintMarkedBy?: string | null;
  fingerprintMarkedAt?: Date | null;
  createdAt: Date;
} | null): RentalContractRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    rentalId: row.rentalId,
    templateId: row.templateId,
    documentRef: row.documentRef,
    status: row.status,
    signedAt: row.signedAt,
    contractVariant: row.contractVariant ?? null,
    depositRequired: row.depositRequired ?? true,
    reservationCreditExcess: row.reservationCreditExcess != null ? Number(row.reservationCreditExcess.toString()).toFixed(2) : '0.00',
    fingerprintTaken: row.fingerprintTaken ?? false,
    fingerprintMarkedBy: row.fingerprintMarkedBy ?? null,
    fingerprintMarkedAt: row.fingerprintMarkedAt ?? null,
    createdAt: row.createdAt,
  };
}

export function toRentalDepositRecord(row: {
  id: string;
  rentalId: string;
  originalAmount: Prisma.Decimal | string;
  currency: string;
  status: string;
  reservationCreditAmount?: Prisma.Decimal | string;
  reservationCreditExcess?: Prisma.Decimal | string;
  paymentAmount?: Prisma.Decimal | string | null;
  paymentMethod?: string | null;
  paymentOperationNumber?: string | null;
  payerName?: string | null;
  payerDocumentNumber?: string | null;
  payerIsExternalAgent?: boolean;
  externalAgentVerifiedBy?: string | null;
  paymentVoucherDocumentId?: string | null;
  paymentRegisteredBy?: string | null;
  createdAt: Date;
} | null): RentalDepositRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    rentalId: row.rentalId,
    originalAmount: row.originalAmount.toString(),
    currency: row.currency,
    status: row.status,
    reservationCreditAmount: Number((row.reservationCreditAmount ?? 0).toString()).toFixed(2),
    reservationCreditExcess: Number((row.reservationCreditExcess ?? 0).toString()).toFixed(2),
    payment:
      row.paymentMethod && row.paymentAmount != null
        ? {
            amount: Number(row.paymentAmount.toString()).toFixed(2),
            method: row.paymentMethod,
            operationNumber: row.paymentOperationNumber ?? null,
            payerName: row.payerName ?? '',
            payerDocumentNumber: row.payerDocumentNumber ?? null,
            payerIsExternalAgent: row.payerIsExternalAgent ?? false,
            externalAgentVerifiedBy: row.externalAgentVerifiedBy ?? null,
            voucherDocumentId: row.paymentVoucherDocumentId ?? null,
            registeredBy: row.paymentRegisteredBy ?? null,
          }
        : null,
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
    vehicleThirdPathEligible: row.vehicle.thirdPathEligible,
    customerNationality: row.customer.nationality ?? null,
    customerDocumentType: row.customer.documentType,
    customerCountryEntryDate: row.customer.countryEntryDate ?? null,
    vehiclePassengerCapacity: row.vehicle.passengerCapacity ?? null,
    vehicleFuelPrice: row.vehicle.fuelPrice != null ? Number(row.vehicle.fuelPrice) : null,
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
    companyDriverDailyRate: row.companyDriverDailyRate != null ? Number(row.companyDriverDailyRate.toString()).toFixed(2) : null,
    cancellation:
      row.cancelReason && row.cancelledAt && row.cancelledBy
        ? { reason: row.cancelReason, note: row.cancelNote, cancelledAt: row.cancelledAt, cancelledBy: row.cancelledBy }
        : null,
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
