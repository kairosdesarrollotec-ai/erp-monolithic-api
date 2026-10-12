import { Injectable } from '@nestjs/common';
import {
  AuthorizedWorkContext,
  WorkContextAuthorizationService,
} from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import type { PaymentAction } from '../policies/payment-role-policy';
import type { DepositScope } from '../ports/deposit-repository.port';

export interface PaymentAccess {
  context: AuthorizedWorkContext;
  scope: DepositScope;
}

/**
 * Autorizacion comun de los handlers de Pagos: (1) valida la asignacion vigente empresa/sede del usuario y
 * (2) aplica la matriz rol-accion versionada (modulo PAYMENT, deny-by-default). El `organizationId` siempre sale
 * de la asignacion real, nunca del cliente (BDD-PAG-001 BR-PAG-009).
 */
@Injectable()
export class PaymentAccessService {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async authorize(
    input: { firebaseUid: string; companyId: string; branchId: string },
    action: PaymentAction,
  ): Promise<PaymentAccess> {
    const context = await this.workContext.authorize({
      firebaseUid: input.firebaseUid,
      companyId: input.companyId,
      branchId: input.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'PAYMENT', action, {
      companyId: context.companyId,
      branchId: context.branchId,
    });
    return {
      context,
      scope: {
        organizationId: context.organizationId,
        companyId: context.companyId,
        branchId: context.branchId,
      },
    };
  }
}
