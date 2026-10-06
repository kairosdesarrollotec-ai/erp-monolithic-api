import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import type { RoleRef } from '../../../users/domain/worker-role';
import { RolePermissionMatrixPort } from '../ports/role-permission-matrix.port';
import { effectivePermissionsOf, matrixVersionOf } from '../../domain/matrix-resolution';
import type { PermissionModule } from '../../domain/permission-action-catalog';
import { GetMyPermissionsQuery } from './get-my-permissions.query';

export interface MyPermissionsResult {
  role: RoleRef;
  matrixVersion: number;
  permissions: { module: PermissionModule; action: string }[];
}

/**
 * GET /me/permissions - permisos EFECTIVOS del usuario autenticado en el
 * contexto de trabajo vigente. Es la unica fuente que usa el front para
 * mostrar/ocultar modulos y acciones (el back sigue autorizando cada comando
 * por su cuenta). Solo exige una asignacion vigente en esa empresa/sede (403
 * si no): cualquier usuario puede ver SUS propios permisos.
 *
 * Resuelve con las mismas reglas que MatrixAuthorizationService (sede >
 * empresa > organizacion; sin entrada = denegado), asi que lo que se muestra
 * coincide con lo que se autoriza. `matrixVersion` cambia cuando cambia
 * cualquiera de las capas consultadas.
 */
@Injectable()
export class GetMyPermissionsHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrix: RolePermissionMatrixPort,
  ) {}

  async execute(query: GetMyPermissionsQuery): Promise<MyPermissionsResult> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    const layers = await this.matrix.getLayers(
      context.organizationId,
      { companyId: context.companyId, branchId: context.branchId },
      { roleId: context.roleId },
    );

    return {
      role: { id: context.roleId, name: context.roleName, key: context.roleKey },
      matrixVersion: matrixVersionOf(layers),
      permissions: effectivePermissionsOf(layers, context.roleId),
    };
  }
}
