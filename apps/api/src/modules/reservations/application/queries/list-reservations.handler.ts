import { ForbiddenException, Injectable } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextRepositoryPort } from '../../../users/application/ports/work-context-repository.port';
import { ListReservationsQuery } from './list-reservations.query';

/** RES-01 - bandeja de reservas. */
@Injectable()
export class ListReservationsHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextRepositoryPort,
  ) {}

  async execute(query: ListReservationsQuery): Promise<ReservationRecord[]> {
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

    return this.reservations.list({
      organizationId: assignment.organizationId,
      operatingCompanyId: query.companyId,
      status: query.status,
    });
  }
}
