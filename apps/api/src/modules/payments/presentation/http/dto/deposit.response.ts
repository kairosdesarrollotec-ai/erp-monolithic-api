import type { DepositStatus } from '../../../domain/deposit-status';
import type { AdjustmentType } from '../../../domain/adjustment-type';

export interface AdjustmentResponseDto {
  id: string;
  depositId: string;
  type: AdjustmentType;
  amount: number;
  reason: string;
  actorId: string;
  createdAt: string;
}

export interface DepositSummaryResponseDto {
  id: string;
  rentalId: string;
  rentalCode: string;
  clientName: string;
  originalAmount: number;
  adjustedAmount: number | null;
  netAmount: number | null;
  currentStatus: DepositStatus;
  createdAt: string;
}

export interface DepositDetailResponseDto {
  id: string;
  rentalId: string;
  rentalCode: string;
  clientName: string;
  vehiclePlate: string | null;
  originalAmount: number;
  adjustedAmount: number | null;
  netAmount: number | null;
  currentStatus: DepositStatus;
  closedAt: string | null;
  closureNotes: string | null;
  adjustments: AdjustmentResponseDto[];
  createdAt: string;
  updatedAt: string;
}

export interface DepositsSummaryResponseDto {
  held: number;
  returned: number;
  retained: number;
  partiallyRetained: number;
  totalAmount: number;
  heldAmount: number;
}

export interface ListDepositsResponseDto {
  data: DepositSummaryResponseDto[];
  meta: {
    total: number;
    hasMore: boolean;
    nextCursorCreatedAt: string | null;
    nextCursorId: string | null;
  };
}
