import { Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { RentalDocumentStoragePort, RentalDocumentContentType, RentalDocumentType } from '../ports/rental-document-storage.port';
import { RentalRepositoryPort } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

export interface RequestRentalDocumentUploadSessionCommand {
  firebaseUid: string;
  companyId: string;
  branchId: string;
  rentalId: string;
  documentType: RentalDocumentType;
  contentType: RentalDocumentContentType;
  contentLength: number;
}

@Injectable()
export class RequestRentalDocumentUploadSessionHandler {
  constructor(
    private readonly storage: RentalDocumentStoragePort,
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(
    command: RequestRentalDocumentUploadSessionCommand,
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

    const rental = await this.rentals.findById(command.rentalId, scope);
    if (!rental) {
      throw new NotFoundException('Alquiler no encontrado.');
    }

    return this.storage.generateSignedUploadUrl({
      companyId: command.companyId,
      rentalId: command.rentalId,
      documentType: command.documentType,
      contentType: command.contentType,
    });
  }
}
