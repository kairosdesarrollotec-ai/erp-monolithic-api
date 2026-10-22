import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AuthorizedWorkContext,
  WorkContextAuthorizationService,
} from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import type { EvidenceAction } from '../policies/evidence-role-policy';
import type { EvidenceDeletionScope } from '../ports/evidence-deletion-request-repository.port';

export interface EvidenceAccess {
  context: AuthorizedWorkContext;
  /** Alcance del usuario (su empresa/sede de trabajo). */
  scope: EvidenceDeletionScope;
}

/** Autorizacion comun: contexto de trabajo vigente + matriz ADM-02 (modulo EVIDENCE, deny-by-default). */
@Injectable()
export class EvidenceAccessService {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async authorize(input: { firebaseUid: string; companyId: string; branchId: string }, action: EvidenceAction): Promise<EvidenceAccess> {
    const context = await this.workContext.authorize(input);
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'EVIDENCE', action, {
      companyId: context.companyId,
      branchId: context.branchId,
    });
    return { context, scope: this.scopeOf(context, input) };
  }

  /** Consultas: basta poder solicitar o aprobar. Devuelve que puede hacer el usuario para que la UI pinte los botones. */
  async authorizeView(input: {
    firebaseUid: string;
    companyId: string;
    branchId: string;
  }): Promise<EvidenceAccess & { canRequest: boolean; canApprove: boolean }> {
    const context = await this.workContext.authorize(input);
    const scope = { companyId: context.companyId, branchId: context.branchId };
    const [canRequest, canApprove] = await Promise.all([
      this.matrixAuth.isAllowed(context.organizationId, context.roleId, 'EVIDENCE', 'REQUEST_DELETION', scope),
      this.matrixAuth.isAllowed(context.organizationId, context.roleId, 'EVIDENCE', 'APPROVE_DELETION', scope),
    ]);
    if (!canRequest && !canApprove) {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        detail: 'Tu rol no tiene permiso para consultar solicitudes de eliminacion de evidencia (EVIDENCE.REQUEST_DELETION / EVIDENCE.APPROVE_DELETION).',
      });
    }
    return { context, scope: this.scopeOf(context, input), canRequest, canApprove };
  }

  private scopeOf(context: AuthorizedWorkContext, input: { companyId: string; branchId: string }): EvidenceDeletionScope {
    return { organizationId: context.organizationId, operatingCompanyId: input.companyId, branchId: input.branchId };
  }
}
