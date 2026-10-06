import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalEvidenceRecord, RentalEvidenceRepositoryPort } from '../ports/rental-evidence-repository.port';
import { ListRentalEvidenceQuery } from './list-rental-evidence.query';
import { RentalRepositoryPort } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';

@Injectable()
export class ListRentalEvidenceHandler {
  constructor(
    private readonly evidence: RentalEvidenceRepositoryPort,
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(query: ListRentalEvidenceQuery): Promise<RentalEvidenceRecord[]> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'UPLOAD_EVIDENCE', { companyId: context.companyId, branchId: context.branchId });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: query.companyId,
      branchId: query.branchId,
    };

    const rental = await this.rentals.findById(query.rentalId, scope);
    if (!rental) {
      throw new NotFoundException('Alquiler no encontrado.');
    }

    return this.evidence.list(query.rentalId, scope);
  }
}
