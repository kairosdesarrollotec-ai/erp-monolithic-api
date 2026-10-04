import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationDocumentRecord, ReservationDocumentRepositoryPort } from '../ports/reservation-document-repository.port';
import { ReservationRepositoryPort } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';

export interface ListReservationDocumentsQuery {
  firebaseUid: string;
  companyId: string;
  branchId: string;
  reservationId: string;
}

@Injectable()
export class ListReservationDocumentsHandler {
  constructor(
    private readonly documents: ReservationDocumentRepositoryPort,
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(query: ListReservationDocumentsQuery): Promise<ReservationDocumentRecord[]> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: query.companyId,
      branchId: query.branchId,
    };

    const reservation = await this.reservations.findById(query.reservationId, scope);
    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada.');
    }

    return this.documents.list(query.reservationId, context.organizationId);
  }
}
