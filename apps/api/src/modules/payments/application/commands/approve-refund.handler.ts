import { Injectable } from '@nestjs/common';
import { DepositAggregate, DepositRepositoryPort } from '../ports/deposit-repository.port';
import { PaymentAccessService } from '../services/payment-access.service';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { assertDepositNotTerminal } from '../../domain/deposit-rules';
import { DepositNotFoundError, PendingDamageResolutionError } from '../../domain/deposit-errors';
import type { DepositStatus } from '../../domain/deposit-status';
import { ApproveRefundCommand } from './approve-refund.command';

/**
 * PAG-P04 / UC-PAG-004: aprueba la devolucion de la garantia al cliente.
 * Pre: no hay ajuste FULL_RETENTION (BR-PAG-005). Garantia pasa a RETURNED.
 */
@Injectable()
export class ApproveRefundHandler {
  constructor(
    private readonly access: PaymentAccessService,
    private readonly deposits: DepositRepositoryPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ApproveRefundCommand): Promise<DepositAggregate> {
    const { context, scope } = await this.access.authorize(command, 'APPROVE_REFUND');

    const deposit = await this.deposits.findById(command.depositId, scope);
    if (!deposit) {
      throw new DepositNotFoundError(command.depositId);
    }

    assertDepositNotTerminal(deposit.status as DepositStatus);

    // BR-PAG-005: si existe un ajuste de FULL_RETENTION, la garantia no puede devolverse
    const hasFullRetention = deposit.adjustments.some((a) => a.type === 'FULL_RETENTION');
    if (hasFullRetention) {
      throw new PendingDamageResolutionError();
    }

    await this.deposits.updateStatus(command.depositId, 'RETURNED');

    await this.auditRepository.recordPaymentEvent(
      {
        organizationId: context.organizationId,
        actorUserId: command.firebaseUid,
        depositId: command.depositId,
        action: 'DEPOSIT_REFUND_APPROVED',
        changes: { notes: command.notes ?? null },
      },
    );

    const updated = await this.deposits.findById(command.depositId, scope);
    return updated!;
  }
}
