import { Injectable } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { ListReservationsQuery } from './list-reservations.query';

/**
 * RES-01 - bandeja de reservas.
 *
 * Hallazgo critico "bug de bandeja": `branchId` ahora viene del propio
 * ListReservationsQuery (ya corregido en el controller, ver
 * reservations.controller.ts) y se pasa tal cual al repositorio - ya no
 * se reutiliza companyId como branchId.
 */
@Injectable()
export class ListReservationsHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(query: ListReservationsQuery): Promise<ReservationRecord[]> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    return this.reservations.list({
      organizationId: context.organizationId,
      operatingCompanyId: query.companyId,
      branchId: query.branchId,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}
