import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextRepositoryPort } from '../../../users/application/ports/work-context-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RequirementsIncompleteError } from '../../domain/reservation-errors';
import { ConfirmReservationCommand } from './confirm-reservation.command';

/**
 * RES-P11 (BR-RES-009, DR-RES-002) - UC-RES-002 del SDD, seccion 10.1 del
 * TDD. El bloqueo del vehiculo es un UNICO evento atomico que ocurre
 * solo cuando pago y documentos estan ambos completos - nunca antes, y
 * nunca en dos pasos separados. La verificacion previa de que ambos
 * campos existan vive aqui (fuera de la transaccion de infraestructura)
 * para poder devolver REQUIREMENTS_INCOMPLETE con el detalle exacto sin
 * abrir una transaccion cuando ya sabemos que va a fallar; la transaccion
 * misma (con su propia re-verificacion + exclusion, seccion 10.1 del
 * TDD) vive en PrismaReservationRepository.confirm.
 */
@Injectable()
export class ConfirmReservationHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextRepositoryPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ConfirmReservationCommand): Promise<ReservationRecord> {
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

    const missing: string[] = [];
    if (!existing.paymentValidatedAt) missing.push('pago del monto de reserva vigente');
    if (!existing.documentsCompletedAt) missing.push('documentos/contrato');
    if (missing.length > 0) {
      throw new RequirementsIncompleteError(missing);
    }

    const confirmed = await this.reservations.confirm(
      command.id,
      assignment.organizationId,
      command.expectedVersion,
    );

    await this.auditRepository.recordReservationEvent({
      organizationId: assignment.organizationId,
      reservationId: confirmed.id,
      action: 'RESERVATION_CONFIRMED',
      changes: { vehicleId: confirmed.vehicleId, startAt: confirmed.startAt, endAt: confirmed.endAt },
    });

    return confirmed;
  }
}
