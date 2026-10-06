import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { GetReservationQuery } from './get-reservation.query';

/**
 * RES-04/RES-05 - detalle de una reserva.
 *
 * Hallazgo critico "IDOR entre sedes/empresas": el scope completo
 * (organizationId + operatingCompanyId + branchId) devuelto por
 * WorkContextAuthorizationService.authorize() se exige en la busqueda,
 * en vez de solo organizationId.
 */
@Injectable()
export class GetReservationHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(query: GetReservationQuery): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RESERVATION', 'READ_DETAIL', { companyId: context.companyId, branchId: context.branchId });

    const reservation = await this.reservations.findById(query.id, {
      organizationId: context.organizationId,
      operatingCompanyId: query.companyId,
      branchId: query.branchId,
    });
    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada.');
    }
    return reservation;
  }
}
