import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { RolePermissionMatrixPort, RolePermissionMatrixSnapshot } from '../ports/role-permission-matrix.port';
import { PERMISSION_ACTION_CATALOG } from '../../domain/permission-action-catalog';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { MatrixScopeService } from '../services/matrix-scope.service';
import { GetRolePermissionMatrixQuery } from './get-role-permission-matrix.query';

export interface RolePermissionMatrixResult extends RolePermissionMatrixSnapshot {
  actionCatalog: typeof PERMISSION_ACTION_CATALOG;
}

/**
 * ADM-02 (Roles y permisos) - lee la matriz vigente + el catalogo de
 * acciones que la pantalla necesita para dibujar las columnas.
 *
 * ROLES DINAMICOS: las filas son por `roleId` (los roles salen de GET
 * /admin/roles). `scope` indica de que ambito sale la foto devuelta (si el
 * ambito pedido no tiene version propia, hereda la de arriba).
 */
@Injectable()
export class GetRolePermissionMatrixHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly matrix: RolePermissionMatrixPort,
    private readonly scopes: MatrixScopeService,
  ) {}

  async execute(query: GetRolePermissionMatrixQuery): Promise<RolePermissionMatrixResult> {
    const context = await this.workContext.authorize({
      firebaseUid: query.actorFirebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.roleId, 'MANAGE_PERMISSIONS', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    const scope = await this.scopes.resolve(context.organizationId, query.scopeCompanyId, query.scopeBranchId);
    const snapshot = await this.matrix.getCurrentVersion(context.organizationId, scope);
    return { ...snapshot, actionCatalog: PERMISSION_ACTION_CATALOG };
  }
}
