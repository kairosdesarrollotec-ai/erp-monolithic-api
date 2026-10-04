import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalDocumentRecord, RentalDocumentRepositoryPort } from '../ports/rental-document-repository.port';
import { RentalRepositoryPort } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';

export interface ListRentalDocumentsQuery {
  firebaseUid: string;
  companyId: string;
  branchId: string;
  rentalId: string;
}

@Injectable()
export class ListRentalDocumentsHandler {
  constructor(
    private readonly documents: RentalDocumentRepositoryPort,
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(query: ListRentalDocumentsQuery): Promise<RentalDocumentRecord[]> {
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

    const rental = await this.rentals.findById(query.rentalId, scope);
    if (!rental) {
      throw new NotFoundException('Alquiler no encontrado.');
    }

    return this.documents.list(query.rentalId, scope);
  }
}
