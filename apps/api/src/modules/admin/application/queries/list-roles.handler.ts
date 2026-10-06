import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { RoleRepositoryPort, RoleWithAssignmentCount } from '../ports/role-repository.port';
import { ListRolesQuery } from './list-roles.query';

/**
 * ADM-02 - GET /admin/roles: roles de la organizacion del admin (por defecto
 * solo activos). Exige ADMIN.MANAGE_PERMISSIONS en el contexto vigente.
 */
@Injectable()
export class ListRolesHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly roles: RoleRepositoryPort,
  ) {}

  async execute(query: ListRolesQuery): Promise<RoleWithAssignmentCount[]> {
    const context = await this.workContext.authorize({
      firebaseUid: query.actorFirebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.roleId, 'MANAGE_PERMISSIONS', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    return this.roles.listByOrganization(context.organizationId, { includeInactive: query.includeInactive });
  }
}
