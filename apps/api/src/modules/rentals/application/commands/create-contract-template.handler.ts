import { Injectable } from '@nestjs/common';
import { RentalRepositoryPort, ContractTemplateRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { CreateContractTemplateCommand } from './create-contract-template.command';

/**
 * ADM / BR-DOC-002 - crea una nueva version de plantilla de contrato para
 * una empresa+tipo y retira automaticamente la version ACTIVE previa
 * (solo puede haber 1 ACTIVE por company+type a la vez, TDD-ALQ-001.md
 * seccion 9.3).
 */
@Injectable()
export class CreateContractTemplateHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: CreateContractTemplateCommand): Promise<ContractTemplateRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.role, 'RENTAL', 'MANAGE_CONTRACT_TEMPLATES');

    return this.transactionManager.run((tx) =>
      this.rentals.createContractTemplate(
        {
          companyId: command.companyId,
          type: command.type,
          effectiveFrom: command.effectiveFrom ?? new Date(),
        },
        tx,
      ),
    );
  }
}
