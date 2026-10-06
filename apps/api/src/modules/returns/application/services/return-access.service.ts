import { Injectable } from '@nestjs/common';
import {
  AuthorizedWorkContext,
  WorkContextAuthorizationService,
} from '../../../users/application/services/work-context-authorization.service';
import { assertReturnRoleAllowed, ReturnAction } from '../policies/return-role-policy';
import { ReturnScope } from '../ports/return-repository.port';

export interface ReturnAccess {
  context: AuthorizedWorkContext;
  scope: ReturnScope;
}

/**
 * Autorización común de todos los handlers de Devolución: (1) valida la asignación vigente
 * empresa/sede del usuario y (2) aplica la policy rol+acción deny-by-default. El `organizationId`
 * siempre sale de la asignación real, nunca del cliente.
 */
@Injectable()
export class ReturnAccessService {
  constructor(private readonly workContext: WorkContextAuthorizationService) {}

  async authorize(
    input: { firebaseUid: string; companyId: string; branchId: string },
    action: ReturnAction,
  ): Promise<ReturnAccess> {
    const context = await this.workContext.authorize({
      firebaseUid: input.firebaseUid,
      companyId: input.companyId,
      branchId: input.branchId,
    });
    assertReturnRoleAllowed(context.role, action);
    return {
      context,
      scope: {
        organizationId: context.organizationId,
        operatingCompanyId: input.companyId,
        branchId: input.branchId,
      },
    };
  }
}
