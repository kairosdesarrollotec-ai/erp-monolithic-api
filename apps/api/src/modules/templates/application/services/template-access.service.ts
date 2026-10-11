import { Injectable } from '@nestjs/common';
import {
  AuthorizedWorkContext,
  WorkContextAuthorizationService,
} from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';

export type TemplateAction = 'VIEW' | 'MANAGE';

export interface TemplateAccess {
  context: AuthorizedWorkContext;
}

/**
 * TDD-TPL-ADR-004 — Autorización común de todos los handlers de Templates.
 * (1) valida la asignación vigente empresa/sede del usuario.
 * (2) aplica la matriz rol-acción versionada (módulo TEMPLATE, deny-by-default).
 */
@Injectable()
export class TemplateAccessService {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async authorize(
    input: { firebaseUid: string; companyId: string; branchId: string },
    action: TemplateAction,
  ): Promise<TemplateAccess> {
    const context = await this.workContext.authorize({
      firebaseUid: input.firebaseUid,
      companyId: input.companyId,
      branchId: input.branchId,
    });
    await this.matrixAuth.assertAllowed(
      context.organizationId,
      context.roleId,
      'TEMPLATE',
      action,
      { companyId: context.companyId, branchId: context.branchId },
    );
    return { context };
  }
}
