import { Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { ReservationDocumentStoragePort, ReservationDocumentContentType, ReservationDocumentType } from '../ports/reservation-document-storage.port';
import { ReservationRepositoryPort } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

export interface RequestReservationDocumentUploadSessionCommand {
  firebaseUid: string;
  companyId: string;
  branchId: string;
  reservationId: string;
  documentType: ReservationDocumentType;
  contentType: ReservationDocumentContentType;
  contentLength: number;
}

@Injectable()
export class RequestReservationDocumentUploadSessionHandler {
  constructor(
    private readonly storage: ReservationDocumentStoragePort,
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(
    command: RequestReservationDocumentUploadSessionCommand,
  ): Promise<{ uploadUrl: string; objectUrl: string }> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    if (command.contentLength > MAX_DOCUMENT_BYTES) {
      throw new PayloadTooLargeException(
        `El archivo supera el tamaño máximo permitido de 20 MB (recibido: ${command.contentLength} bytes).`,
      );
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

    return this.storage.generateSignedUploadUrl({
      companyId: command.companyId,
      reservationId: command.reservationId,
      documentType: command.documentType,
      contentType: command.contentType,
    });
  }
}
