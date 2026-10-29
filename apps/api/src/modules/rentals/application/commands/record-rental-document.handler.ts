import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RentalDocumentRecord, RentalDocumentRepositoryPort } from '../ports/rental-document-repository.port';
import { RentalDocumentType } from '../ports/rental-document-storage.port';
import { RentalRepositoryPort } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { isTrustedObjectUrl } from '../../../../common/storage/local-dev-storage';

export interface RecordRentalDocumentCommand {
  firebaseUid: string;
  companyId: string;
  branchId: string;
  rentalId: string;
  documentType: RentalDocumentType;
  objectUrl: string;
}

@Injectable()
export class RecordRentalDocumentHandler {
  constructor(
    private readonly documents: RentalDocumentRepositoryPort,
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(command: RecordRentalDocumentCommand): Promise<RentalDocumentRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    if (!isTrustedObjectUrl(command.objectUrl)) {
      throw new BadRequestException('objectUrl debe ser una URL de GCS válida (obtenida de upload-url).');
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

    return this.documents.record({
      rentalId: command.rentalId,
      scope,
      documentType: command.documentType,
      objectUrl: command.objectUrl,
    });
  }
}
