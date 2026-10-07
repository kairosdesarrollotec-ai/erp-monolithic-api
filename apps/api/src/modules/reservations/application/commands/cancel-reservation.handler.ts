import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
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
 *
 * Hallazgo CRITICO de revision de seguimiento de PR#6 (d442508,
 * "cancelacion vulnerable a carrera TOCTOU"): la defensa principal es
 * el `updateMany` atomico con version+scope+estado en el where (ver
 * PrismaReservationRepository.cancel), que no depende del nivel de
 * aislamiento. Se pide ademas `Serializable` aqui (igual que
 * ConfirmReservationHandler, TDD-RES-001.md seccion 10.1) como defensa
 * adicional en profundidad para el resto de lecturas de esta
 * transaccion (existencia, estado terminal), no como el unico
 * mecanismo de proteccion.
 *
 * Hallazgo real 23 sep 2026: se agrega la publicacion a outbox_events
 * (mismo criterio que ConfirmReservationHandler) - la cancelacion no
 * publicaba ningun evento pese a que el modelo ya existia.
 */
@Injectable()
export class CancelReservationHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: CancelReservationCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    // Hallazgo ALTO PR#6 ("falta autorizacion granular por rol/accion"):
    // MATRIZ-TRAZABILIDAD-COMPLETA.md (fila RES-08) restringe la
    // cancelacion por no-show a Gerencia unicamente - las demas razones
    // de cancelacion usan el allow-list operativo normal.
    await this.matrixAuth.assertAllowed(
      context.organizationId,
      context.roleId,
      'RESERVATION',
      command.reason === 'NO_SHOW' ? 'CANCEL_NO_SHOW' : 'CANCEL_CUSTOMER_REQUESTED_CHANGE',
      { companyId: context.companyId, branchId: context.branchId },
    );

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

    return this.transactionManager.run(
      async (tx) => {
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

        await this.outboxRepository.publish(
          {
            aggregateType: 'Reservation',
            aggregateId: cancelled.id,
            eventType: 'ReservationCancelled',
            payload: {
              organizationId: context.organizationId,
              operatingCompanyId: command.companyId,
              branchId: command.branchId,
              reason: command.reason,
              note: command.note ?? null,
              cancelledBy: command.firebaseUid,
            },
          },
          tx,
        );

        return cancelled;
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
