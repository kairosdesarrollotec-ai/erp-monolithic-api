import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AuthorizedWorkContext,
  WorkContextAuthorizationService,
} from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import type { HrAdministrationAction } from '../policies/hr-administration-role-policy';

export interface HrAdministrationScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export interface HrAdministrationAccess {
  context: AuthorizedWorkContext;
  scope: HrAdministrationScope;
}

/**
 * Servicio de autorización transversal para el módulo de Administración de Personal:
 * 1. Valida asignación activa usuario -> empresa -> sede (WorkContextAuthorizationService).
 * 2. Aplica la matriz de roles y permisos dinámicos (ADM-02) con módulo 'HR_ADMINISTRATION' y ámbito de empresa/sede.
 * 3. Provee método helper para verificación condicional de permisos (isActionAllowed).
 */
@Injectable()
export class HrAdministrationAccessService {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async authorize(
    input: { firebaseUid: string; companyId: string; branchId: string },
    action: HrAdministrationAction,
  ): Promise<HrAdministrationAccess> {
    const context = await this.workContext.authorize({
      firebaseUid: input.firebaseUid,
      companyId: input.companyId,
      branchId: input.branchId,
    });
    await this.matrixAuth.assertAllowed(
      context.organizationId,
      context.roleId,
      'HR_ADMINISTRATION',
      action,
      { companyId: context.companyId, branchId: context.branchId },
    );
    return {
      context,
      scope: {
        organizationId: context.organizationId,
        operatingCompanyId: context.companyId,
        branchId: context.branchId,
      },
    };
  }

  async authorizeAny(
    input: { firebaseUid: string; companyId: string; branchId: string },
    actions: readonly [HrAdministrationAction, ...HrAdministrationAction[]],
  ): Promise<HrAdministrationAccess> {
    const context = await this.workContext.authorize({
      firebaseUid: input.firebaseUid,
      companyId: input.companyId,
      branchId: input.branchId,
    });
    const scope = { companyId: context.companyId, branchId: context.branchId };
    for (const action of actions) {
      if (await this.matrixAuth.isAllowed(context.organizationId, context.roleId, 'HR_ADMINISTRATION', action, scope)) {
        return {
          context,
          scope: {
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        };
      }
    }
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'HR_ADMINISTRATION', actions[0], scope);
    throw new ForbiddenException({ code: 'ROLE_NOT_ALLOWED', detail: 'Rol sin permiso sobre Administración de Personal.' });
  }

  async isActionAllowed(context: AuthorizedWorkContext, action: HrAdministrationAction): Promise<boolean> {
    return this.matrixAuth.isAllowed(
      context.organizationId,
      context.roleId,
      'HR_ADMINISTRATION',
      action,
      { companyId: context.companyId, branchId: context.branchId },
    );
  }
}
