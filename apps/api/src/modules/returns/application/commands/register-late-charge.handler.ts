import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { InvalidLateChargeError, ReturnNotFoundError, ReturnStateConflictError } from '../../domain/return-errors';
import { computeReturnLateness, LATE_CHARGE_REGISTRABLE_STATUSES } from '../../domain/return-lateness';
import { roundMoney } from '../../domain/return-rules';
import { ReturnStatus } from '../../domain/return-status';
import { RegisterReturnLateChargeCommand } from './register-late-charge.command';

/** Con el vehículo ya recibido y hasta antes del cierre definitivo (CERRADA/CANCELADA/PROGRAMADA no aplican). */
const LATE_CHARGE_STATUSES: ReadonlySet<ReturnStatus> = new Set<ReturnStatus>(LATE_CHARGE_REGISTRABLE_STATUSES);

/**
 * DEC-DEV-LATE-CHARGE-002 (Fiorella, 2026-10-16) - Retraso en la devolución pasada la tolerancia (30 min): SÍ hay cargo,
 * y por ahora se registra MANUALMENTE: el monto lo digita un usuario autorizado (misma autorización que el cargo de
 * paralización: Administración, Gerencia, Finanzas); NO hay cálculo automático (el cargo sugerido de
 * DEC-DEV-LATE-CHARGE-001 sigue siendo solo informativo). Volver a registrar corrige el monto (última versión en la
 * fila; cada registro queda en auditoría y emite CargoRetrasoRegistrado.v1). No ajusta la garantía por sí mismo.
 */
@Injectable()
export class RegisterReturnLateChargeHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: RegisterReturnLateChargeCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'CHARGE_IMMOBILIZATION');

    const amount = roundMoney(command.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new InvalidLateChargeError('El monto del cargo por retraso debe ser mayor que cero.');
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
      if (!LATE_CHARGE_STATUSES.has(current.status)) {
        throw new ReturnStateConflictError('registrar cargo por retraso en', current.status);
      }
      const now = this.clock.now();
      const lateness = computeReturnLateness(current, now);
      if (!current.receivedAt || !lateness || !lateness.isLate) {
        throw new InvalidLateChargeError(
          'No corresponde cargo por retraso: la devolución no superó la tolerancia de 30 minutos sobre la hora pactada (BR-DEV-003).',
        );
      }

      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          lateChargeAmount: amount,
          lateChargeNotes: command.notes,
          lateChargeRegisteredById: command.firebaseUid,
          lateChargeRegisteredAt: now,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: 'RETURN_LATE_CHARGE_REGISTERED',
          changes: {
            returnId: updated.id,
            amount,
            previousAmount: current.lateChargeAmount ?? null,
            notes: command.notes,
            lateMinutes: lateness.lateMinutes,
            manual: true,
          },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: updated.id,
          eventType: 'CargoRetrasoRegistrado.v1',
          payload: {
            returnId: updated.id,
            rentalId: updated.rentalId,
            customerId: updated.customerId,
            amount,
            lateMinutes: lateness.lateMinutes,
            manual: true,
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
