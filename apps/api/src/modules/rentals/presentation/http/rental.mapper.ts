import { RentalRecord } from '../../application/ports/rental-repository.port';
import { RentalResponse } from './dto/rental.response';

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
          templateVersionId: record.contract.templateVersionId,
          documentRef: record.contract.documentRef,
          status: record.contract.status,
          signedAt: record.contract.signedAt ? record.contract.signedAt.toISOString() : null,
          createdAt: record.contract.createdAt.toISOString(),
        }
      : null,
    deposit: record.deposit
      ? {
          id: record.deposit.id,
          originalAmount: record.deposit.originalAmount,
          currency: record.deposit.currency,
          status: record.deposit.status,
          createdAt: record.deposit.createdAt.toISOString(),
        }
      : null,
  };
}
