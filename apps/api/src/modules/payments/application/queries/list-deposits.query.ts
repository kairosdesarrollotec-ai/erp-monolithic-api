import type { DepositStatus } from '../../domain/deposit-status';

export class ListDepositsQuery {
  constructor(
    readonly firebaseUid: string,
    readonly companyId: string,
    readonly branchId: string,
    readonly status?: DepositStatus,
    readonly rentalId?: string,
    readonly limit: number = 20,
    readonly cursor?: { createdAt: Date; id: string },
  ) {}
}
