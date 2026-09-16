import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextRepositoryPort } from '../../../users/application/ports/work-context-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { CancelReservationCommand } from './cancel-reservation.command';

/**
 * UC-RES-003 (BR-RES-003, confirmado 31 ago 2026) - no existe
 * reprogramacion de reserva bajo ningun criterio; cualquier cambio de
 * fecha/hora/vehiculo pasa por este mismo comando de cancelacion, nunca
 * por una edicion. Libera el vehicle_commitment si existia (solo si la
 * reserva estaba CONFIRMED).
 */
@Injectable()
export class CancelReservationHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextRepositoryPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: CancelReservationCommand): Promise<ReservationRecord> {
    const assignment = await this.workContext.findValidAssignment({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    if (!assignment) {
      throw new ForbiddenException(
        'La combinacion de empresa/sede no es una asignacion vigente para este usuario.',
      );
    }

    const existing = await this.reservations.findById(command.id, assignment.organizationId);
    if (!existing) {
      throw new NotFoundException('Reserva no encontrada.');
    }

    const cancelled = await this.reservations.cancel({
      id: command.id,
      organizationId: assignment.organizationId,
      expectedVersion: command.expectedVersion,
      reason: command.reason,
      note: command.note,
    });

    await this.auditRepository.recordReservationEvent({
      organizationId: assignment.organizationId,
      reservationId: cancelled.id,
      action: 'RESERVATION_CANCELLED_FOR_CHANGE',
      changes: { reason: command.reason, note: command.note ?? null },
    });

    return cancelled;
  }
}
