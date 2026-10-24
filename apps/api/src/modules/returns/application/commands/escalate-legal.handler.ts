import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnNotFoundError } from '../../domain/return-errors';
import { EscalateLegalCommand } from './escalate-legal.command';

/**
 * DEC-DEV-LEGAL-001 (23-oct-2026, Frente C):
 * Anotación y derivación a la vía legal con notificación a Gerencia.
 */
@Injectable()
export class EscalateLegalHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: EscalateLegalCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'CLOSE');

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }

    const now = this.clock.now();

    return this.transactionManager.run(async (tx) => {
      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          legalEscalated: true,
          legalEscalatedAt: now,
          legalEscalatedBy: command.firebaseUid,
          legalNotes: command.notes.trim(),
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: 'RETURN_LEGAL_ESCALATED',
          changes: {
            returnId: updated.id,
            notes: command.notes,
            escalatedAt: now,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: updated.id,
          eventType: 'DevolucionEscaladaLegal.v1',
          payload: {
            returnId: updated.id,
            rentalId: updated.rentalId,
            customerId: updated.customerId,
            notes: command.notes,
            escalatedAt: now.toISOString(),
            escalatedBy: command.firebaseUid,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
