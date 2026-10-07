import { Injectable } from '@nestjs/common';
import {
  AuthorizedWorkContext,
  WorkContextAuthorizationService,
} from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import type { IncidentAction } from '../policies/incident-role-policy';
import type { IncidentScope } from '../ports/incident-repository.port';

export interface IncidentAccess {
  context: AuthorizedWorkContext;
  scope: IncidentScope;
}

/**
 * Autorizacion comun de los handlers de Incidencias: (1) valida la asignacion vigente empresa/sede del usuario y
 * (2) aplica la matriz rol-accion versionada (modulo INCIDENT, deny-by-default). El `organizationId` siempre sale
 * de la asignacion real, nunca del cliente.
 */
@Injectable()
export class IncidentAccessService {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async authorize(
    input: { firebaseUid: string; companyId: string; branchId: string },
    action: IncidentAction,
  ): Promise<IncidentAccess> {
    const context = await this.workContext.authorize({
      firebaseUid: input.firebaseUid,
      companyId: input.companyId,
      branchId: input.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'INCIDENT', action, { companyId: context.companyId, branchId: context.branchId });
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
