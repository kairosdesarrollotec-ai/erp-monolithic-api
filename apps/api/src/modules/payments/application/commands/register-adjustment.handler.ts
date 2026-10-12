import { Injectable } from '@nestjs/common';
import { AdjustmentRecord, DepositRepositoryPort } from '../ports/deposit-repository.port';
import { PaymentAccessService } from '../services/payment-access.service';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { assertDepositNotTerminal } from '../../domain/deposit-rules';
import { assertAdjustmentAmountValid } from '../../domain/deposit-rules';
import { DepositNotFoundError } from '../../domain/deposit-errors';
import type { DepositStatus } from '../../domain/deposit-status';
import { RegisterAdjustmentCommand } from './register-adjustment.command';

/**
 * PAG-P03 / UC-PAG-003: registra un ajuste append-only sobre una garantia activa.
 * Valida: ownership, estado no-terminal (INV-PAG-001), monto disponible (INV-PAG-003 / BR-PAG-001).
 */
@Injectable()
export class RegisterAdjustmentHandler {
  constructor(
    private readonly access: PaymentAccessService,
    private readonly deposits: DepositRepositoryPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RegisterAdjustmentCommand): Promise<AdjustmentRecord> {
    const { context, scope } = await this.access.authorize(command, 'REGISTER_ADJUSTMENT');

    const deposit = await this.deposits.findById(command.depositId, scope);
    if (!deposit) {
      throw new DepositNotFoundError(command.depositId);
    }

    assertDepositNotTerminal(deposit.status as DepositStatus);
    assertAdjustmentAmountValid(
      deposit.originalAmount,
      deposit.adjustments,
      command.amount,
    );

    const adjustment = await this.deposits.addAdjustment(command.depositId, {
      type: command.type,
      amount: command.amount,
      reason: command.reason,
      authorizedBy: command.firebaseUid,
    });

    await this.auditRepository.recordPaymentEvent(
      {
        organizationId: context.organizationId,
        actorUserId: command.firebaseUid,
        depositId: command.depositId,
        action: 'DEPOSIT_ADJUSTMENT_REGISTERED',
        changes: {
          type: command.type,
          adjustmentId: adjustment.id,
        },
      },
    );

    return adjustment;
  }
}
