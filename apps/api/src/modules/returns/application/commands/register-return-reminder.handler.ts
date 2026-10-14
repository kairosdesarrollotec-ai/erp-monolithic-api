import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { ReturnRecord, ReturnReminderRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnReminderRepositoryPort } from '../ports/return-reminder-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import {
  InvalidReturnReminderResultError,
  ReturnNotFoundError,
  ReturnReminderAlreadySentError,
  ReturnReminderNotFoundError,
  ReturnReminderVersionConflictError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import { RegisterReturnReminderCommand } from './register-return-reminder.command';

/** Margen de tolerancia para relojes desfasados entre el dispositivo del operador y el servidor. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface RegisterReturnReminderResult {
  reminder: ReturnReminderRecord;
  rentalReturn: ReturnRecord;
}

/**
 * DEV-01 / BR-DEV-004 / DAT-DEV-001 - El operador registra que envió (o no pudo enviar) el recordatorio generado por
 * el sistema: hora de envío, resultado SENT | FAILED y nota (obligatoria si FAILED). Un recordatorio FAILED admite un
 * nuevo registro (reintento); uno SENT es definitivo. Requiere If-Match con la versión del recordatorio.
 * Acción de matriz: RETURN.CREATE (DEV-01 lo opera quien programa la devolución; no se inventan acciones nuevas).
 */
@Injectable()
export class RegisterReturnReminderHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly reminders: ReturnReminderRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RegisterReturnReminderCommand): Promise<RegisterReturnReminderResult> {
    const { context, scope } = await this.access.authorize(command, 'CREATE');

    const now = this.clock.now();
    const sentAt = command.sentAt ?? now;
    if (sentAt.getTime() > now.getTime() + FUTURE_SKEW_MS) {
      throw new InvalidReturnReminderResultError('La hora de envío del recordatorio no puede estar en el futuro.');
    }
    const note = command.note?.trim() || null;
    if (command.result === 'FAILED' && !note) {
      throw new InvalidReturnReminderResultError('Un recordatorio FALLIDO requiere una nota con el motivo (no contestó, número inválido, etc.).');
    }

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }
    if (existing.status === 'CANCELADA') {
      throw new ReturnStateConflictError('registrar el recordatorio de', existing.status);
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.reminders.findByReturnId(command.id, scope, tx);
      if (!current) {
        throw new ReturnReminderNotFoundError(command.id);
      }
      if (current.status === 'SENT') {
        throw new ReturnReminderAlreadySentError();
      }
      if (current.version !== command.expectedVersion) {
        throw new ReturnReminderVersionConflictError();
      }

      const reminder = await this.reminders.registerResult(
        {
          returnId: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          status: command.result,
          sentAt,
          sentBy: command.firebaseUid,
          resultNote: note,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: existing.rentalId,
          action: command.result === 'SENT' ? 'RETURN_REMINDER_SENT' : 'RETURN_REMINDER_FAILED',
          changes: {
            returnId: existing.id,
            reminderId: reminder.id,
            result: command.result,
            sentAt: sentAt.toISOString(),
            attempts: reminder.attempts,
            note,
          },
        },
        tx,
      );

      return { reminder, rentalReturn: { ...existing, reminder } };
    });
  }
}
