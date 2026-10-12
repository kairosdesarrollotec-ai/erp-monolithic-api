import { RentalRecord } from '../../application/ports/rental-repository.port';
import { RentalResponse } from './dto/rental.response';
import { fromCents, toCents } from '../../domain/reservation-credit';
import { evaluateExtensionRequirements } from '../../domain/extension-requirements';

export function toRentalResponse(record: RentalRecord): RentalResponse {
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
          amountCollected: fromCents(
            toCents(record.deposit.originalAmount) - toCents(record.deposit.reservationCreditAmount ?? '0'),
          ),
          createdAt: record.deposit.createdAt.toISOString(),
        }
      : null,
    ...(record.reservationCredit !== undefined ? { reservationCredit: record.reservationCredit } : {}),
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
