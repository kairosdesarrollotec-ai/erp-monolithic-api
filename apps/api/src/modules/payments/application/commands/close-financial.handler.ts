import { Injectable } from '@nestjs/common';
import { DepositAggregate, DepositRepositoryPort } from '../ports/deposit-repository.port';
import { PaymentAccessService } from '../services/payment-access.service';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { assertDepositNotTerminal } from '../../domain/deposit-rules';
import { DepositNotFoundError } from '../../domain/deposit-errors';
import type { DepositStatus } from '../../domain/deposit-status';
import { CloseFinancialCommand } from './close-financial.command';

/**
 * PAG-P05 / UC-PAG-005: cierra el expediente financiero de la garantia.
 * Estado final determinado por retainedAmount vs originalAmount:
 *   retainedAmount == 0                  → RETURNED
 *   0 < retainedAmount < originalAmount  → PARTIALLY_RETAINED
 *   retainedAmount == originalAmount     → RETAINED
 */
@Injectable()
export class CloseFinancialHandler {
  constructor(
    private readonly access: PaymentAccessService,
    private readonly deposits: DepositRepositoryPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: CloseFinancialCommand): Promise<DepositAggregate> {
    const { context, scope } = await this.access.authorize(command, 'CLOSE_FINANCIAL');

    const deposit = await this.deposits.findById(command.depositId, scope);
    if (!deposit) {
      throw new DepositNotFoundError(command.depositId);
    }

    assertDepositNotTerminal(deposit.status as DepositStatus);

    const finalStatus = this.determineFinalStatus(deposit.originalAmount, command.retainedAmount);
    const closedAt = new Date();

    await this.deposits.updateStatus(command.depositId, finalStatus, closedAt, command.notes);

    await this.auditRepository.recordPaymentEvent(
      {
        organizationId: context.organizationId,
        actorUserId: command.firebaseUid,
        depositId: command.depositId,
        action: 'DEPOSIT_FINANCIAL_CLOSED',
        changes: {
          finalStatus,
          retainedAmount: command.retainedAmount,
        },
      },
    );

    const updated = await this.deposits.findById(command.depositId, scope);
    return updated!;
  }

  private determineFinalStatus(originalAmount: number, retainedAmount: number): DepositStatus {
    if (retainedAmount <= 0) return 'RETURNED';
    if (retainedAmount >= originalAmount) return 'RETAINED';
    return 'PARTIALLY_RETAINED';
  }
}
