import { Injectable } from '@nestjs/common';
import {
  AuthorizedWorkContext,
  WorkContextAuthorizationService,
} from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';

export type CustomerAction = 'READ' | 'WRITE';

export interface CustomerScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export interface CustomerAccess {
  context: AuthorizedWorkContext;
  scope: CustomerScope;
}

/**
 * Autorización común de los handlers de Clientes: (1) valida la asignación vigente empresa/sede
 * del usuario y (2) aplica la matriz rol-acción versionada (módulo CUSTOMER, deny-by-default).
 * El `organizationId` siempre sale de la asignación real, nunca del cliente.
 */
@Injectable()
export class CustomerAccessService {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async authorize(
    input: { firebaseUid: string; companyId: string; branchId: string },
    action: CustomerAction,
  ): Promise<CustomerAccess> {
    const context = await this.workContext.authorize({
      firebaseUid: input.firebaseUid,
      companyId: input.companyId,
      branchId: input.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'CUSTOMER', action, { companyId: context.companyId, branchId: context.branchId });
    return {
      context,
      scope: {
        organizationId: context.organizationId,
        operatingCompanyId: context.companyId,
        branchId: input.branchId,
      },
    };
  }
}
