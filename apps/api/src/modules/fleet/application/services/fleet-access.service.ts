import { Injectable } from '@nestjs/common';
import {
  AuthorizedWorkContext,
  WorkContextAuthorizationService,
} from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';

export type FleetAction = 'READ' | 'WRITE' | 'CROSS_BRANCH' | 'MANAGE_THIRD_PATH' | 'REGISTER_VEHICLE_OPERATIONAL_FORMAT' | 'VIEW_VEHICLE_OPERATIONAL_FORMAT';

export interface FleetScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export interface FleetAccess {
  context: AuthorizedWorkContext;
  scope: FleetScope;
}

/**
 * Autorización común de los handlers de Flota: (1) valida la asignación vigente empresa/sede
 * del usuario y (2) aplica la matriz rol-acción versionada (módulo FLEET, deny-by-default).
 * El `organizationId` siempre sale de la asignación real, nunca del cliente.
 *
 * Cuando se pasa `opts.targetBranchId` y difiere de la sede del contexto, también se exige
 * la acción CROSS_BRANCH (aislamiento IDOR por sede — Finding #2, PR#34).
 */
@Injectable()
export class FleetAccessService {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async authorize(
    input: { firebaseUid: string; companyId: string; branchId: string },
    action: FleetAction,
    opts?: { targetBranchId?: string | null },
  ): Promise<FleetAccess> {
    const context = await this.workContext.authorize({
      firebaseUid: input.firebaseUid,
      companyId: input.companyId,
      branchId: input.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'FLEET', action, { companyId: context.companyId, branchId: context.branchId });
    if (opts?.targetBranchId && opts.targetBranchId !== context.branchId) {
      await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'FLEET', 'CROSS_BRANCH', { companyId: context.companyId, branchId: context.branchId });
      // Validación de aislamiento: el target debe pertenecer a la misma organización.
      // La comprobación por organizationId se delega al repositorio, que filtra siempre por organizationId del contexto.
    }
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
