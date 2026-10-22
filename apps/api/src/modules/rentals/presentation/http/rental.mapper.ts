import { buildVehicleDataWarnings } from '../../../../common/domain/vehicle-data-warnings';
import { RentalRecord } from '../../application/ports/rental-repository.port';
import { GuaranteePaymentResponse, RentalResponse } from './dto/rental.response';
import { fromCents, toCents } from '../../domain/reservation-credit';
import { evaluateExtensionRequirements } from '../../domain/extension-requirements';
import { requiredDocumentsFor, resolveNationality } from '../../domain/required-documents';
import { requiredGuarantee } from '../../domain/guarantee-requirement';

export function toRentalResponse(record: RentalRecord): RentalResponse {
  const nationality = resolveNationality(record.customerNationality, record.customerDocumentType);
  return {
    id: record.id,
    organizationId: record.organizationId,
    operatingCompanyId: record.operatingCompanyId,
    branchId: record.branchId,
    inquiryId: record.inquiryId,
    reservationId: record.reservationId,
    customerId: record.customerId,
    customerName: record.customerName,
    customerDocNumber: record.customerDocNumber,
    vehicleId: record.vehicleId,
    vehiclePlate: record.vehiclePlate,
    vehicleBrand: record.vehicleBrand,
    vehicleModel: record.vehicleModel,
    vehicleDepositMinimum: record.vehicleDepositMinimum,
    vehicleThirdPathEligible: record.vehicleThirdPathEligible ?? false,
    customerNationality: nationality,
    requiredDocuments: requiredDocumentsFor(nationality).map((doc) => ({
      code: doc.code,
      label: doc.label,
      kind: doc.kind,
      field: doc.field,
    })),
    requiredGuarantee: requiredGuarantee(record.vehicleDepositMinimum, record.notaryEvaluation?.result ?? null),
    cancellation: record.cancellation
      ? {
          reason: record.cancellation.reason,
          note: record.cancellation.note,
          cancelledAt: record.cancellation.cancelledAt.toISOString(),
          cancelledBy: record.cancellation.cancelledBy,
        }
      : null,
    vehiclePassengerCapacity: record.vehiclePassengerCapacity ?? null,
    vehicleFuelPrice: record.vehicleFuelPrice ?? null,
    vehicleWarnings: buildVehicleDataWarnings({
      passengerCapacity: record.vehiclePassengerCapacity,
      depositMinimum: record.vehicleDepositMinimum,
      fuelPrice: record.vehicleFuelPrice,
    }),
    companionsCount: (record.parties ?? []).filter((p) => p.role === 'RESPONSIBLE').length,
    planCode: record.planCode,
    status: record.status,
    startAt: record.startAt ? record.startAt.toISOString() : null,
    expectedEndAt: record.expectedEndAt ? record.expectedEndAt.toISOString() : null,
    alcoholTestResult: record.alcoholTestResult,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    updatedAt: record.updatedAt.toISOString(),
    updatedBy: record.updatedBy,
    version: record.version,
    etag: `"${record.version}"`,
    parties: record.parties?.map((p) => ({
      id: p.id,
      customerId: p.customerId,
      role: p.role,
      addendumDocumentRef: p.addendumDocumentRef ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    notaryEvaluation: record.notaryEvaluation
      ? {
          id: record.notaryEvaluation.id,
          policyVersion: record.notaryEvaluation.policyVersion,
          result: record.notaryEvaluation.result,
          reason: record.notaryEvaluation.reason,
          evaluatedAt: record.notaryEvaluation.evaluatedAt.toISOString(),
          approvedBy: record.notaryEvaluation.approvedBy,
          justification: record.notaryEvaluation.justification,
          biometricVerified: record.notaryEvaluation.biometricVerified ?? false,
          biometricVerifiedBy: record.notaryEvaluation.biometricVerifiedBy ?? null,
          previousRentalsCount: record.notaryEvaluation.previousRentalsCount ?? null,
          pendingApproval:
            (record.notaryEvaluation.result === 'THIRD_PATH_ELIGIBLE' || record.notaryEvaluation.result === 'MANUAL_REVIEW') &&
            !record.notaryEvaluation.approvedBy,
        }
      : null,
    contract: record.contract
      ? {
          id: record.contract.id,
          templateId: record.contract.templateId,
          documentRef: record.contract.documentRef,
          status: record.contract.status,
          signedAt: record.contract.signedAt ? record.contract.signedAt.toISOString() : null,
          contractVariant: record.contract.contractVariant ?? null,
          depositRequired: record.contract.depositRequired ?? true,
          reservationCreditExcess: record.contract.reservationCreditExcess ?? '0.00',
          createdAt: record.contract.createdAt.toISOString(),
        }
      : null,
    deposit: record.deposit
      ? {
          id: record.deposit.id,
          originalAmount: record.deposit.originalAmount,
          currency: record.deposit.currency,
          status: record.deposit.status,
          reservationCreditAmount: record.deposit.reservationCreditAmount ?? '0.00',
          reservationCreditExcess: record.deposit.reservationCreditExcess ?? '0.00',
          amountCollected: fromCents(
            toCents(record.deposit.originalAmount) - toCents(record.deposit.reservationCreditAmount ?? '0'),
          ),
          payment: record.deposit.payment
            ? {
                amount: record.deposit.payment.amount,
                method: record.deposit.payment.method as GuaranteePaymentResponse['method'],
                operationNumber: record.deposit.payment.operationNumber,
                payerName: record.deposit.payment.payerName,
                payerDocumentNumber: record.deposit.payment.payerDocumentNumber,
                payerIsExternalAgent: record.deposit.payment.payerIsExternalAgent,
                externalAgentVerifiedBy: record.deposit.payment.externalAgentVerifiedBy,
                voucherDocumentId: record.deposit.payment.voucherDocumentId,
                registeredBy: record.deposit.payment.registeredBy,
              }
            : null,
          createdAt: record.deposit.createdAt.toISOString(),
        }
      : null,
    depositRequired: record.contract?.depositRequired ?? true,
    reservationCreditExcess: record.deposit?.reservationCreditExcess ?? record.contract?.reservationCreditExcess ?? '0.00',
    ...(record.reservationCredit !== undefined ? { reservationCredit: record.reservationCredit } : {}),
    ...(record.companyDriverCharge !== undefined ? { companyDriverCharge: record.companyDriverCharge } : {}),
    ...(record.extensions
      ? {
          extensions: record.extensions.map((e) => ({
            id: e.id,
            requestedEndAt: e.requestedEndAt.toISOString(),
            status: e.status,
            requestedAt: e.requestedAt.toISOString(),
            resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
            paymentId: e.paymentId,
            addendumDocumentRef: e.addendumDocumentRef,
            requirements: evaluateExtensionRequirements(e, record.expectedEndAt),
          })),
        }
      : {}),
  };
}
