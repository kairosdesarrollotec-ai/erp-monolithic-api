import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { isTerminalReservationStatus } from '../../domain/reservation-status';
import { ReservationStateConflictError } from '../../domain/reservation-errors';
import { CancelReservationCommand } from './cancel-reservation.command';

/**
 * UC-RES-003 (BR-RES-003, confirmado 31 ago 2026) - no existe
 * reprogramacion de reserva bajo ningun criterio; cualquier cambio de
 * fecha/hora/vehiculo pasa por este mismo comando de cancelacion, nunca
 * por una edicion. Libera el vehicle_commitment si existia (solo si la
 * reserva estaba CONFIRMED).
 *
 * Hallazgo alto "maquina de estados incompleta": una reserva CANCELLED o
 * CONVERTED es terminal - no se puede volver a cancelar
 * (isTerminalReservationStatus, ver domain/reservation-status.ts para la
 * nota sobre por que PENDING_SALE_RESOLUTION queda deliberadamente fuera
 * de esta guarda).
 *
 * Hallazgo critico "cambio de estado y auditoria no son atomicos":
 * mutacion + auditoria en una unica transaccion via TransactionManagerPort.
 *
 * Hallazgo critico "IDOR entre sedes/empresas": scope completo.
 */
@Injectable()
export class CancelReservationHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: CancelReservationCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.reservations.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Reserva no encontrada.');
    }
    if (isTerminalReservationStatus(existing.status)) {
      throw new ReservationStateConflictError('cancelar', existing.status);
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.reservations.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Reserva no encontrada.');
      }
      if (isTerminalReservationStatus(current.status)) {
        throw new ReservationStateConflictError('cancelar', current.status);
      }

      const cancelled = await this.reservations.cancel(
        {
          id: command.id,
          organizationId: context.organizationId,
          operatingCompanyId: command.companyId,
          branchId: command.branchId,
          expectedVersion: command.expectedVersion,
          reason: command.reason,
          note: command.note,
        },
        tx,
      );

      await this.auditRepository.recordReservationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          reservationId: cancelled.id,
          action: 'RESERVATION_CANCELLED_FOR_CHANGE',
          changes: { reason: command.reason, note: command.note ?? null },
        },
        tx,
      );

      return cancelled;
    });
  }
}
