import { Injectable } from '@nestjs/common';
import { RentalRepositoryPort, ContractTemplateRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { ListContractTemplatesQuery } from './list-contract-templates.query';

@Injectable()
export class ListContractTemplatesHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(query: ListContractTemplatesQuery): Promise<ContractTemplateRecord[]> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'MANAGE_CONTRACT_TEMPLATES', { companyId: context.companyId, branchId: context.branchId });

    return this.rentals.listContractTemplates(query.companyId);
  }
}
