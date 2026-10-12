import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { ContractTemplateResolver } from '../services/contract-template-resolver';
import { ContractVariant } from '../../domain/contract-variant';
import { GetContractTemplateQuery } from './get-contract-template.query';

export interface ContractTemplateSelection {
  rentalId: string;
  variant: ContractVariant | null;
  requestedType: string;
  fallbackUsed: boolean;
  template: {
    id: string;
    type: string;
    name: string;
    version: number | null;
    effectiveFrom: Date | null;
  } | null;
}

/**
 * BR-DOC-002/003 - ENTREGA-03: plantilla de contrato vigente que corresponde
 * a la combinacion (titular natural/juridica x con/sin conductor) del
 * alquiler. Solo lectura: la formalizacion vuelve a resolverla en servidor.
 */
@Injectable()
export class GetContractTemplateHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly resolver: ContractTemplateResolver,
  ) {}

  async execute(query: GetContractTemplateQuery): Promise<ContractTemplateSelection> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'READ', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    const rental = await this.rentals.findById(query.id, {
      organizationId: context.organizationId,
      operatingCompanyId: query.companyId,
      branchId: query.branchId,
    });
    if (!rental) {
      throw new NotFoundException('Alquiler no encontrado.');
    }

    const resolved = await this.resolver.resolve(query.companyId, context.organizationId, query.variant);
    return {
      rentalId: rental.id,
      variant: query.variant ?? null,
      requestedType: resolved.requestedType,
      fallbackUsed: resolved.fallbackUsed,
      template: resolved.template
        ? {
            id: resolved.template.id,
            type: resolved.template.type,
            name: resolved.template.name,
            version: resolved.template.version,
            effectiveFrom: resolved.template.effectiveFrom,
          }
        : null,
    };
  }
}
