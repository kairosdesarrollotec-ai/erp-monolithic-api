import { Injectable } from '@nestjs/common';
import { DepositAggregate, DepositRepositoryPort } from '../ports/deposit-repository.port';
import { PaymentAccessService } from '../services/payment-access.service';
import { DepositNotFoundError } from '../../domain/deposit-errors';
import { GetDepositQuery } from './get-deposit.query';

/**
 * PAG-02 — detalle con historial de ajustes (UC-PAG-002, BR-PAG-009).
 * Una garantia de otra empresa/sede responde 404, nunca 403 (no revela existencia — INV-PAG-005).
 */
@Injectable()
export class GetDepositHandler {
  constructor(
    private readonly access: PaymentAccessService,
    private readonly deposits: DepositRepositoryPort,
  ) {}

  async execute(query: GetDepositQuery): Promise<DepositAggregate> {
    const { scope } = await this.access.authorize(query, 'READ_DETAIL');
    const found = await this.deposits.findById(query.depositId, scope);
    if (!found) {
      throw new DepositNotFoundError(query.depositId);
    }
    return found;
  }
}
