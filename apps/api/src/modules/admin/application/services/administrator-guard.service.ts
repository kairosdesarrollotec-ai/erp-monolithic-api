import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { RolePermissionMatrixPort, RolePermissionMatrixSnapshot } from '../ports/role-permission-matrix.port';
import { hasAdministratorPermissions, layersForContext, scopeKey } from '../../domain/matrix-resolution';
import { LastAdministratorRoleError } from '../../domain/role-errors';

/**
 * Salvaguarda "ultimo administrador" por PERMISOS (no por el nombre de un rol).
 *
 * Una asignacion es "administradora" si su rol esta activo y, en el ambito de
 * ESA asignacion (empresa/sede), tiene a la vez ADMIN.MANAGE_PERMISSIONS y
 * ADMIN.MANAGE_USERS. Si una operacion (guardar una matriz, desactivar un rol)
 * convertiria "hay al menos un administrador" en "no hay ninguno", la
 * organizacion quedaria en deadlock (nadie podria volver a gestionar permisos
 * ni usuarios desde la aplicacion) -> 409 LAST_ADMINISTRATOR_ROLE.
 *
 * Siempre debe invocarse dentro de la misma transaccion Serializable que la
 * mutacion, para que dos operaciones concurrentes no puedan, entre las dos,
 * dejar la organizacion en cero administradores.
 */
@Injectable()
export class AdministratorGuardService {
  constructor(
    private readonly adminUsers: AdminUserRepositoryPort,
    private readonly matrix: RolePermissionMatrixPort,
  ) {}

  /** Ids de las asignaciones vigentes que son administradoras segun `snapshots` (por defecto, la matriz vigente). */
  async administratorAssignmentIds(
    organizationId: string,
    tx: Prisma.TransactionClient | undefined,
    snapshots?: RolePermissionMatrixSnapshot[],
  ): Promise<string[]> {
    const [assignments, current] = await Promise.all([
      this.adminUsers.listEffectiveAssignments(organizationId, tx),
      snapshots ? Promise.resolve(snapshots) : this.matrix.getAllCurrentSnapshots(organizationId, tx),
    ]);
    return assignments
      .filter((assignment) => {
        const layers = layersForContext(current, { companyId: assignment.companyId, branchId: assignment.branchId });
        return hasAdministratorPermissions(layers, assignment.roleId);
      })
      .map((assignment) => assignment.id);
  }

  /**
   * Antes de guardar `candidate` (una foto nueva de un ambito): si hoy hay al
   * menos un administrador y con la foto nueva no quedaria ninguno, 409.
   */
  async assertMatrixKeepsAnAdministrator(
    organizationId: string,
    candidate: RolePermissionMatrixSnapshot,
    tx: Prisma.TransactionClient | undefined,
  ): Promise<void> {
    const current = await this.matrix.getAllCurrentSnapshots(organizationId, tx);
    const before = await this.administratorAssignmentIds(organizationId, tx, current);
    if (before.length === 0) return; // ya no habia ninguno: esta operacion no lo empeora.

    const candidateKey = scopeKey(candidate.scope);
    const after = await this.administratorAssignmentIds(organizationId, tx, [
      ...current.filter((snapshot) => scopeKey(snapshot.scope) !== candidateKey),
      candidate,
    ]);
    if (after.length === 0) throw new LastAdministratorRoleError();
  }

  /**
   * Antes de desactivar `roleId`: sus asignaciones dejan de ser vigentes (rol
   * inactivo). Si hoy hay administradores y TODOS pertenecen a ese rol, 409.
   * (El handler ya rechazo antes los roles con asignaciones activas con
   * ROLE_HAS_ACTIVE_ASSIGNMENTS; esta es la red de seguridad por permisos.)
   */
  async assertRoleDeactivationKeepsAnAdministrator(
    organizationId: string,
    roleId: string,
    tx: Prisma.TransactionClient | undefined,
  ): Promise<void> {
    const [assignments, current] = await Promise.all([
      this.adminUsers.listEffectiveAssignments(organizationId, tx),
      this.matrix.getAllCurrentSnapshots(organizationId, tx),
    ]);
    const administrators = assignments.filter((assignment) =>
      hasAdministratorPermissions(
        layersForContext(current, { companyId: assignment.companyId, branchId: assignment.branchId }),
        assignment.roleId,
      ),
    );
    if (administrators.length > 0 && administrators.every((assignment) => assignment.roleId === roleId)) {
      throw new LastAdministratorRoleError();
    }
  }
}
