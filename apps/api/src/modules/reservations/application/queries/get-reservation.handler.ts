import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextRepositoryPort } from '../../../users/application/ports/work-context-repository.port';
import { GetReservationQuery } from './get-reservation.query';

/** RES-04/RES-05 - detalle de una reserva. */
@Injectable()
export class GetReservationHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextRepositoryPort,
  ) {}

  async execute(query: GetReservationQuery): Promise<ReservationRecord> {
    const assignment = await this.workContext.findValidAssignment({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    if (!assignment) {
      throw new ForbiddenException(
        'La combinacion de empresa/sede no es una asignacion vigente para este usuario.',
      );
    }

    const reservation = await this.reservations.findById(query.id, assignment.organizationId);
    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada.');
    }
    return reservation;
  }
}
