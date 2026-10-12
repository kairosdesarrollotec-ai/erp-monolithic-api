import { Injectable } from '@nestjs/common';
import { DepositRepositoryPort, DepositSummary } from '../ports/deposit-repository.port';
import { PaymentAccessService } from '../services/payment-access.service';
import { ListDepositsQuery } from './list-deposits.query';

/** PAG-01 — bandeja de garantias con filtros y paginacion keyset (UC-PAG-001, BR-PAG-009). */
@Injectable()
export class ListDepositsHandler {
  constructor(
    private readonly access: PaymentAccessService,
    private readonly deposits: DepositRepositoryPort,
  ) {}

  async execute(query: ListDepositsQuery): Promise<{ data: DepositSummary[]; total: number }> {
    const { scope } = await this.access.authorize(query, 'READ_LIST');
    return this.deposits.listByScope(scope, {
      status: query.status,
      rentalId: query.rentalId,
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}
