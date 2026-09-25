import { Injectable } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';
import type { AdminAction } from '../policies/admin-role-policy';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';

/**
 * ADM-02 (Roles y permisos) - Enforcement de permisos para el módulo ADMIN.
 * Delega en MatrixAuthorizationService para centralizar la evaluación
 * de la matriz versionada rol-modulo-accion.
 */
@Injectable()
export class AdminMatrixAuthorizationService {
  constructor(private readonly matrixAuth: MatrixAuthorizationService) {}

  async assertAllowed(organizationId: string, role: WorkerRole, action: AdminAction): Promise<void> {
    return this.matrixAuth.assertAllowed(organizationId, role, 'ADMIN', action);
  }
}
