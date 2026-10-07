import { Injectable } from '@nestjs/common';
import type { AdminAction } from '../policies/admin-role-policy';
import { MatrixAuthorizationService, MatrixContextScope } from '../../../authorization/matrix-authorization.service';

/**
 * ADM-02 (Roles y permisos) - Enforcement de permisos para el módulo ADMIN.
 * Delega en MatrixAuthorizationService para centralizar la evaluación
 * de la matriz versionada rol-modulo-accion.
 *
 * ROLES DINAMICOS: se eliminó el atajo `role === 'PLATFORM_ADMIN'`; el rol de
 * sistema PLATFORM_ADMIN tiene todos los permisos sembrados como filas (y su
 * fila no es editable desde ADM-02), asi que pasa por la misma evaluacion.
 */
@Injectable()
export class AdminMatrixAuthorizationService {
  constructor(private readonly matrixAuth: MatrixAuthorizationService) {}

  async assertAllowed(organizationId: string, roleId: string, action: AdminAction, scope?: MatrixContextScope): Promise<void> {
    return this.matrixAuth.assertAllowed(organizationId, roleId, 'ADMIN', action, scope);
  }
}
