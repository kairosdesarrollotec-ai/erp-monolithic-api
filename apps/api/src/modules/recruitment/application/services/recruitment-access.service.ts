import { ForbiddenException, Injectable } from '@nestjs/common';
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

  /**
   * Autoriza si el rol tiene AL MENOS UNA de las acciones (p. ej. buscador de entrevistadores:
   * MANAGE_INTERVIEW o VIEW_CANDIDATE). Si ninguna aplica, falla con el mismo 403 ROLE_NOT_ALLOWED
   * que `authorize` para la primera accion de la lista.
   */
  async authorizeAny(
    input: { firebaseUid: string; companyId: string; branchId: string },
    actions: readonly [RecruitmentAction, ...RecruitmentAction[]],
  ): Promise<RecruitmentAccess> {
    const context = await this.workContext.authorize({
      firebaseUid: input.firebaseUid,
      companyId: input.companyId,
      branchId: input.branchId,
    });
    const scope = { companyId: context.companyId, branchId: context.branchId };
    for (const action of actions) {
      if (await this.matrixAuth.isAllowed(context.organizationId, context.roleId, 'RECRUITMENT', action, scope)) {
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
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RECRUITMENT', actions[0], scope);
    throw new ForbiddenException({ code: 'ROLE_NOT_ALLOWED', detail: 'Rol sin permiso sobre Reclutamiento.' });
  }

  /** Exige ADEMAS una accion ya conocida el contexto (p. ej. datos sensibles); lanza el mismo 403 ROLE_NOT_ALLOWED. */
  async assertActionAllowed(context: AuthorizedWorkContext, action: RecruitmentAction): Promise<void> {
    await this.matrixAuth.assertAllowed(
      context.organizationId,
      context.roleId,
      'RECRUITMENT',
      action,
      { companyId: context.companyId, branchId: context.branchId },
    );
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
