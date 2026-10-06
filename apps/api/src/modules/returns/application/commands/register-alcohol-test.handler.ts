import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnNotFoundError, ReturnStateConflictError } from '../../domain/return-errors';
import { assertCanTransitionReturn } from '../../domain/return-status';
import { RegisterReturnAlcoholTestCommand } from './register-alcohol-test.command';

/**
 * DEV-04 / BR-DEV-005 / DR-DEV-003 - Alcolímetro de salida (tolerancia cero).
 * FAVORABLE -> INSPECCION. DESFAVORABLE/RECHAZADO -> el expediente PERMANECE en RECEPCION_PROVISIONAL, el
 * vehículo sigue en custodia preventiva de VeloxRent y se escala a Gerencia (evento EscaladoAGerencia.v1). El
 * comando no falla en ese caso: el resultado queda registrado (200).
 */
@Injectable()
export class RegisterReturnAlcoholTestHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: RegisterReturnAlcoholTestCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'REGISTER_ALCOHOL_TEST');

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }
    if (existing.status !== 'RECEPCION_PROVISIONAL') {
      throw new ReturnStateConflictError('registrar alcolímetro en', existing.status);
    }

    const passing = command.result === 'FAVORABLE';

    return this.transactionManager.run(async (tx) => {
      const current = await this.returns.findById(command.id, scope, tx);
      if (!current) {
        throw new ReturnNotFoundError(command.id);
      }
      if (current.status !== 'RECEPCION_PROVISIONAL') {
        throw new ReturnStateConflictError('registrar alcolímetro en', current.status);
      }
      if (passing) {
        assertCanTransitionReturn(current.status, 'INSPECCION');
      }

      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          status: passing ? 'INSPECCION' : undefined,
          custodyHolder: 'VELOXRENT',
          alcoholTestResult: command.result,
          alcoholTestNotes: command.notes,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: passing ? 'RETURN_ALCOHOL_TEST_PASSED' : 'RETURN_ALCOHOL_TEST_FAILED_ESCALATED',
          changes: {
            returnId: updated.id,
            result: command.result,
            notes: command.notes,
            newStatus: updated.status,
            escalatedTo: passing ? undefined : 'GERENCIA',
          },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: updated.id,
          eventType: passing ? 'DevolucionAlcoholFavorable.v1' : 'EscaladoAGerencia.v1',
          payload: {
            returnId: updated.id,
            rentalId: updated.rentalId,
            result: command.result,
            status: updated.status,
            escalatedTo: passing ? null : 'GERENCIA',
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
