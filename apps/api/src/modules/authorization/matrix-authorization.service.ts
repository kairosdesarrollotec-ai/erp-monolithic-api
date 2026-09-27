import { ForbiddenException, Injectable } from '@nestjs/common';
import type { WorkerRole } from '../users/domain/worker-role';
import { RolePermissionMatrixPort } from '../admin/application/ports/role-permission-matrix.port';

export type MatrixModule = 'RESERVATION' | 'INQUIRY' | 'ADMIN';

/**
 * ADM-02 (Roles y permisos) - Servicio central de autorización por matriz.
 *
 * Aplica la filosofía "deny-by-default": si no existe una entrada explícita
 * para (rol, modulo, accion) o si `allowed === false`, la acción se rechaza
 * lanzando ForbiddenException.
 *
 * Cuando la organización aún no tiene una versión personalizada guardada en BD
 * (versión 0), `matrix.getCurrentVersion()` devuelve la matriz implícita basada
 * en las políticas estáticas (buildDefaultRolePermissionMatrix), garantizando
 * 100% de retrocompatibilidad con las reglas por defecto del sistema.
 */
@Injectable()
export class MatrixAuthorizationService {
  constructor(private readonly matrix: RolePermissionMatrixPort) {}

  async isAllowed(
    organizationId: string,
    role: WorkerRole,
    module: MatrixModule,
    action: string,
  ): Promise<boolean> {
    const snapshot = await this.matrix.getCurrentVersion(organizationId);
    const entry = snapshot.entries.find(
      (candidate) => candidate.role === role && candidate.module === module && candidate.action === action,
    );
    return entry?.allowed ?? false;
  }

  async assertAllowed(
    organizationId: string,
    role: WorkerRole,
    module: MatrixModule,
    action: string,
  ): Promise<void> {
    const snapshot = await this.matrix.getCurrentVersion(organizationId);
    const entry = snapshot.entries.find(
      (candidate) => candidate.role === role && candidate.module === module && candidate.action === action,
    );

    if (!entry || !entry.allowed) {
      if (module === 'ADMIN') {
        throw new ForbiddenException({
          code: 'ADMIN_ACTION_NOT_ALLOWED_BY_MATRIX',
          detail: `El rol ${role} no tiene permitida la accion ADMIN.${action} segun la matriz de permisos vigente (version ${snapshot.version}).`,
        });
      }

      const entityName = module === 'RESERVATION' ? 'una Reserva' : 'una Consulta';
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        detail: `El rol ${role} no tiene permiso para realizar la accion ${action} sobre ${entityName} segun la matriz de permisos vigente (version ${snapshot.version}).`,
      });
    }
  }
}
