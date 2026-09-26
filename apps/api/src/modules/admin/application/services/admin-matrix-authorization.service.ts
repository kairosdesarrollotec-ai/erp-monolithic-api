import { ForbiddenException, Injectable } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';
import { RolePermissionMatrixPort } from '../ports/role-permission-matrix.port';
import type { AdminAction } from '../policies/admin-role-policy';

/**
 * Hallazgo CRITICO de revalidacion PR#7 ("ADM-02 no se aplica"): la
 * matriz de roles/permisos (SaveRolePermissionMatrixHandler /
 * GetRolePermissionMatrixHandler) se guarda y versiona correctamente,
 * pero hasta ahora ningun endpoint la consultaba para autorizar - todo
 * el modulo de Administracion seguia usando exclusivamente la policy
 * estatica hardcodeada (`admin-role-policy.ts`). Un admin que editaba la
 * matriz desde la pantalla ADM-02 no cambiaba nada en el comportamiento
 * real del sistema.
 *
 * Este servicio es el punto de enforcement real: lee la version vigente
 * de la matriz para la organizacion (que si nunca se guardo una version
 * propia, es la version 0 implicita construida a partir de las mismas
 * policies estaticas - ver default-role-permission-matrix.ts, asi que el
 * comportamiento no cambia hasta que un admin guarde una version nueva)
 * y busca la entrada (rol, modulo, accion).
 *
 * Alcance de este cambio (decision explicita con Russbel, 2026-09-24):
 * solo el modulo ADMIN pasa a resolverse por matriz en esta iteracion.
 * Reservations/Inquiries/Dashboard/Notifications siguen en sus policies
 * estaticas (`reservation-role-policy.ts`, `inquiry-role-policy.ts`) -
 * extenderles el mismo enforcement por matriz queda como siguiente paso,
 * no en este PR.
 *
 * Filosofia "deny by default" ya establecida en este codebase (ver
 * `admin-role-policy.ts`, `reservation-role-policy.ts`): si no hay
 * ninguna entrada para (rol, modulo, accion) en la version vigente, se
 * deniega - nunca se asume permitido por ausencia de dato.
 */
@Injectable()
export class AdminMatrixAuthorizationService {
  constructor(private readonly matrix: RolePermissionMatrixPort) {}

  async assertAllowed(organizationId: string, role: WorkerRole, action: AdminAction): Promise<void> {
    if (role === 'PLATFORM_ADMIN') return;
    const snapshot = await this.matrix.getCurrentVersion(organizationId);
    const entry = snapshot.entries.find(
      (candidate) => candidate.role === role && candidate.module === 'ADMIN' && candidate.action === action,
    );

    if (!entry || !entry.allowed) {
      throw new ForbiddenException({
        code: 'ADMIN_ACTION_NOT_ALLOWED_BY_MATRIX',
        detail: `El rol ${role} no tiene permitida la accion ADMIN.${action} segun la matriz de permisos vigente (version ${snapshot.version}).`,
      });
    }
  }
}
