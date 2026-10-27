import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { InvalidFuelPenaltyError, ReturnNotFoundError, ReturnStateConflictError } from '../../domain/return-errors';
import { calculateFuelPenalty } from '../../domain/damage-calculator';
import { roundMoney } from '../../domain/return-rules';
import { ReturnStatus } from '../../domain/return-status';
import { RegisterReturnFuelPenaltyCommand } from './register-fuel-penalty.command';

const FUEL_PENALTY_STATUSES: ReadonlySet<ReturnStatus> = new Set<ReturnStatus>([
  'RECEPCION_PROVISIONAL',
  'INSPECCION',
  'SIN_DANOS',
  'CON_DANOS',
  'CIERRE_FINANCIERO',
]);

@Injectable()
export class RegisterReturnFuelPenaltyHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: RegisterReturnFuelPenaltyCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'CHARGE_IMMOBILIZATION');

    const amount = roundMoney(command.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new InvalidFuelPenaltyError('El monto de la penalidad por combustible no puede ser negativo.');
    }
    if (!command.reason || command.reason.trim().length < 3) {
      throw new InvalidFuelPenaltyError(
        'El motivo del ajuste de la penalidad por combustible es obligatorio (mínimo 3 caracteres).',
      );
    }

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.returns.findById(command.id, scope, tx);
      if (!current) {
        throw new ReturnNotFoundError(command.id);
      }
      if (!FUEL_PENALTY_STATUSES.has(current.status)) {
        throw new ReturnStateConflictError('ajustar penalidad por combustible en', current.status);
      }
      const now = this.clock.now();
      const calculatedAmount = current.fuelLevelAtReturn
        ? calculateFuelPenalty(current.fuelLevelAtReturn, current.vehicleFuelPenaltyPerLine)
        : 0;

      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          fuelPenaltyAmount: amount,
          fuelPenaltyNotes: command.reason.trim(),
          fuelPenaltyRegisteredById: command.firebaseUid,
          fuelPenaltyRegisteredAt: now,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: 'RETURN_FUEL_PENALTY_ADJUSTED',
          changes: {
            returnId: updated.id,
            calculatedAmount,
            appliedAmount: amount,
            reason: command.reason.trim(),
            registeredById: command.firebaseUid,
            registeredAt: now.toISOString(),
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: updated.id,
          eventType: 'MultaCombustibleAjustada.v1',
          payload: {
            returnId: updated.id,
            rentalId: updated.rentalId,
            calculatedAmount,
            appliedAmount: amount,
            reason: command.reason.trim(),
            organizationId: context.organizationId,
            operatingCompanyId: command.companyId,
            branchId: command.branchId,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
