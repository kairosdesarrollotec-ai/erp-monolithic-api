import type { DepositAggregate, DepositSummary, AdjustmentRecord } from '../../application/ports/deposit-repository.port';
import type {
  AdjustmentResponseDto,
  DepositDetailResponseDto,
  DepositSummaryResponseDto,
} from './dto/deposit.response';

function toAdjustmentResponse(adj: AdjustmentRecord): AdjustmentResponseDto {
  return {
    id: adj.id,
    depositId: adj.depositId,
    type: adj.type,
    amount: adj.amount,
    reason: adj.reason,
    actorId: adj.authorizedBy,
    createdAt: adj.createdAt.toISOString(),
  };
}

export function toDepositSummaryResponse(summary: DepositSummary): DepositSummaryResponseDto {
  return {
    id: summary.id,
    rentalId: summary.rentalId,
    rentalCode: summary.rentalCode,
    clientName: summary.clientName,
    originalAmount: summary.originalAmount,
    adjustedAmount: summary.adjustedAmount,
    netAmount: summary.netAmount,
    currentStatus: summary.currentStatus,
    createdAt: summary.createdAt.toISOString(),
  };
}

export function toDepositDetailResponse(aggregate: DepositAggregate): DepositDetailResponseDto {
  const adjustedAmount = aggregate.adjustments.reduce((s, a) => s + a.amount, 0);
  return {
    id: aggregate.id,
    rentalId: aggregate.rentalId,
    rentalCode: aggregate.rentalCode,
    clientName: aggregate.clientName,
    vehiclePlate: aggregate.vehiclePlate,
    originalAmount: aggregate.originalAmount,
    adjustedAmount: adjustedAmount > 0 ? adjustedAmount : null,
    netAmount: adjustedAmount > 0 ? aggregate.originalAmount - adjustedAmount : null,
    currentStatus: aggregate.status,
    closedAt: aggregate.closedAt?.toISOString() ?? null,
    closureNotes: aggregate.closureNotes,
    adjustments: aggregate.adjustments.map(toAdjustmentResponse),
    createdAt: aggregate.createdAt.toISOString(),
    updatedAt: aggregate.updatedAt.toISOString(),
  };
}
