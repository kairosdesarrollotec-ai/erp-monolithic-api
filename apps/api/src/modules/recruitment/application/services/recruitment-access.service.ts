import { Injectable } from '@nestjs/common';
import {
  AuthorizedWorkContext,
  WorkContextAuthorizationService,
} from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import type { RecruitmentAction } from '../policies/recruitment-role-policy';

export interface RecruitmentScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export interface RecruitmentAccess {
  context: AuthorizedWorkContext;
  scope: RecruitmentScope;
}

/**
 * Servicio de autorización transversal para el módulo de Reclutamiento y Selección:
 * 1. Valida asignación activa usuario -> empresa -> sede (WorkContextAuthorizationService).
 * 2. Aplica la matriz de roles y permisos dinámicos (ADM-02) con módulo 'RECRUITMENT' y ámbito específico.
 * 3. Provee método helper para verificación condicional de permisos sensibles (isActionAllowed).
 */
@Injectable()
export class RecruitmentAccessService {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async authorize(
    input: { firebaseUid: string; companyId: string; branchId: string },
    action: RecruitmentAction,
  ): Promise<RecruitmentAccess> {
    const context = await this.workContext.authorize({
      firebaseUid: input.firebaseUid,
      companyId: input.companyId,
      branchId: input.branchId,
    });
    await this.matrixAuth.assertAllowed(
      context.organizationId,
      context.roleId,
      'RECRUITMENT',
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

  async isActionAllowed(context: AuthorizedWorkContext, action: RecruitmentAction): Promise<boolean> {
    return this.matrixAuth.isAllowed(
      context.organizationId,
      context.roleId,
      'RECRUITMENT',
      action,
      { companyId: context.companyId, branchId: context.branchId },
    );
  }
}
