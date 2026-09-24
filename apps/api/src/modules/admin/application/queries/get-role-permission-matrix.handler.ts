import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { RolePermissionMatrixPort, RolePermissionMatrixSnapshot } from '../ports/role-permission-matrix.port';
import { PERMISSION_ACTION_CATALOG } from '../../domain/permission-action-catalog';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { GetRolePermissionMatrixQuery } from './get-role-permission-matrix.query';

export interface RolePermissionMatrixResult extends RolePermissionMatrixSnapshot {
  actionCatalog: typeof PERMISSION_ACTION_CATALOG;
}

/**
 * ADM-02 (Roles y permisos) - lee la matriz vigente + el catalogo de
 * acciones que la pantalla necesita para dibujar las columnas.
 */
@Injectable()
export class GetRolePermissionMatrixHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly matrix: RolePermissionMatrixPort,
  ) {}

  async execute(query: GetRolePermissionMatrixQuery): Promise<RolePermissionMatrixResult> {
    const context = await this.workContext.authorize({
      firebaseUid: query.actorFirebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.role, 'MANAGE_PERMISSIONS');

    const snapshot = await this.matrix.getCurrentVersion(context.organizationId);
    return { ...snapshot, actionCatalog: PERMISSION_ACTION_CATALOG };
  }
}
