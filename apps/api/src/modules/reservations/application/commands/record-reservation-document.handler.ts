import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReservationDocumentRecord, ReservationDocumentRepositoryPort } from '../ports/reservation-document-repository.port';
import { ReservationDocumentType } from '../ports/reservation-document-storage.port';
import { ReservationRepositoryPort } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';

export interface RecordReservationDocumentCommand {
  firebaseUid: string;
  companyId: string;
  branchId: string;
  reservationId: string;
  documentType: ReservationDocumentType;
  objectUrl: string;
}

@Injectable()
export class RecordReservationDocumentHandler {
  constructor(
    private readonly documents: ReservationDocumentRepositoryPort,
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(command: RecordReservationDocumentCommand): Promise<ReservationDocumentRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    if (!command.objectUrl.startsWith('https://storage.googleapis.com/')) {
      throw new BadRequestException('objectUrl debe ser una URL de GCS válida (obtenida de upload-url).');
    }

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const reservation = await this.reservations.findById(command.reservationId, scope);
    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada.');
    }

    return this.documents.record({
      reservationId: command.reservationId,
      organizationId: context.organizationId,
      documentType: command.documentType,
      objectUrl: command.objectUrl,
    });
  }
}
