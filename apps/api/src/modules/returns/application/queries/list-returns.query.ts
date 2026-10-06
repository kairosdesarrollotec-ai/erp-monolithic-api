import { ReturnStatus } from '../../domain/return-status';
import { RETURN_LIST_DEFAULT_LIMIT } from '../../domain/return-pagination';

export class ListReturnsQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly status?: ReturnStatus,
    public readonly limit: number = RETURN_LIST_DEFAULT_LIMIT,
    public readonly cursor?: { createdAt: Date; id: string },
  ) {}
}
