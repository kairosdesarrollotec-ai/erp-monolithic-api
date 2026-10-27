import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { ReservationReminderRepositoryPort } from '../ports/reservation-reminder-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReservationStateConflictError, ReservationVersionConflictError } from '../../domain/reservation-errors';
import { InvalidReservationReminderResultError } from '../../domain/reservation-reminder';
import { RegisterReservationReminderCommand } from './register-reservation-reminder.command';

const FUTURE_SKEW_MS = 5 * 60 * 1000;

@Injectable()
export class RegisterReservationReminderHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly reminders: ReservationReminderRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: RegisterReservationReminderCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RESERVATION', 'REGISTER_REMINDER', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    const now = this.clock.now();
    const sentAt = command.sentAt ?? now;
    if (sentAt.getTime() > now.getTime() + FUTURE_SKEW_MS) {
      throw new InvalidReservationReminderResultError('La fecha de envío del recordatorio no puede estar en el futuro.');
    }
    const note = command.note?.trim() || null;
    if (command.result === 'FAILED' && !note) {
      throw new InvalidReservationReminderResultError('Un recordatorio FALLIDO requiere una nota con el motivo (cliente no contesta, etc.).');
    }

    return this.transactionManager.run(async (tx) => {
      const scope = {
        organizationId: context.organizationId,
        operatingCompanyId: context.companyId,
        branchId: context.branchId,
      };

      const existing = await this.reservations.findById(command.id, scope, tx);
      if (!existing) {
        throw new NotFoundException(`Reserva ${command.id} no encontrada en este contexto.`);
      }

      if (existing.version !== command.expectedVersion) {
        throw new ReservationVersionConflictError();
      }

      if (existing.status === 'CANCELLED' || existing.status === 'CONVERTED') {
        throw new ReservationStateConflictError('registrar recordatorio en', existing.status);
      }

      const dueAt = new Date(existing.startAt.getTime() - 3 * 60 * 60 * 1000);
      const messageText = `Recordatorio de recojo: Hola ${existing.customerName}, su reserva del vehículo ${existing.vehiclePlate} está programada para recojo.`;

      const reminder = await this.reminders.registerReminder(
        {
          reservationId: command.id,
          organizationId: context.organizationId,
          operatingCompanyId: context.companyId,
          branchId: context.branchId,
          result: command.result,
          dueAt,
          messageText,
          sentAt,
          sentBy: command.firebaseUid,
          note,
        },
        tx,
      );

      // Increment reservation version
      const updated = await this.reservations.incrementVersion(command.id, scope, command.expectedVersion, tx);

      await this.auditRepository.recordReservationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          reservationId: command.id,
          action: 'RESERVATION_REMINDER_REGISTERED',
          changes: {
            reminderId: reminder.id,
            result: command.result,
            sentAt: sentAt.toISOString(),
            sentBy: command.firebaseUid,
            note,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'reservation',
          aggregateId: command.id,
          eventType: 'ReservationReminderRegistered.v1',
          payload: {
            reservationId: command.id,
            reminderId: reminder.id,
            status: command.result,
            sentAt: sentAt.toISOString(),
            sentBy: command.firebaseUid,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
