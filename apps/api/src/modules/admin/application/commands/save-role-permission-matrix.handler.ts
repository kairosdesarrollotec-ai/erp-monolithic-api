import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RolePermissionEntry, RolePermissionMatrixPort, RolePermissionMatrixSnapshot } from '../ports/role-permission-matrix.port';
import { RoleRepositoryPort } from '../ports/role-repository.port';
import {
  actionKey,
  INCOMPATIBLE_ACTION_PAIRS,
  PERMISSION_ACTION_CATALOG,
} from '../../domain/permission-action-catalog';
import { PLATFORM_ADMIN_KEY } from '../../domain/system-roles';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { AdministratorGuardService } from '../services/administrator-guard.service';
import { MatrixScopeService } from '../services/matrix-scope.service';
import { SaveRolePermissionMatrixCommand } from './save-role-permission-matrix.command';

export interface SaveRolePermissionMatrixResult extends RolePermissionMatrixSnapshot {
  actionCatalog: typeof PERMISSION_ACTION_CATALOG;
}

/**
 * ADM-02 - "Guardar cambios" de la matriz (contrato punto 7). Regla
 * "Solo una version vigente a la vez" (punto 9, igual criterio que
 * ADM-03): esta accion siempre INSERTA una foto completa nueva, nunca
 * edita filas existentes - el historial queda completo (punto 11).
 *
 * ROLES DINAMICOS (fase 2):
 *  - Las celdas son por `roleId`. Completitud = roles ACTIVOS de la
 *    organizacion x catalogo de acciones (un rol nuevo debe venir en la
 *    matriz, con sus casillas; nace con todo en false). Una entrada de un
 *    rol inexistente/inactivo, una accion fuera del catalogo o una celda
 *    repetida -> 400 INCOMPLETE_MATRIX.
 *  - PLATFORM_ADMIN no es editable desde ADM-02: sus entradas enviadas se
 *    IGNORAN (no se exige que vengan) y siempre se guarda allowed = true en
 *    todo el catalogo; guardar una matriz nunca puede quitarle permisos.
 *  - Ambito opcional (scopeCompanyId / scopeBranchId): la foto vale para
 *    toda la organizacion (sin ambito), una empresa o una sede.
 *  - Salvaguarda del ultimo administrador: si la foto nueva dejaria a la
 *    organizacion sin ningun rol activo con asignaciones que tenga
 *    MANAGE_PERMISSIONS y MANAGE_USERS -> 409 LAST_ADMINISTRATOR_ROLE.
 *  Todo corre en UNA transaccion Serializable (lectura de roles/matriz +
 *    insercion + auditoria): dos guardados concurrentes no pueden, entre los
 *    dos, violar la salvaguarda.
 *
 * Segregacion de funciones (punto 8): valida INCOMPATIBLE_ACTION_PAIRS
 * antes de guardar - si un mismo rol queda con `allowed: true` en las 2
 * acciones de un par incompatible, rechaza con 409 explicando cual es
 * el conflicto.
 *
 * NOTA DE ALCANCE: esta matriz es la fuente de enforcement de Reservas,
 * Consultas, Alquileres, Incidencias y Administracion. Devoluciones,
 * Clientes y Flota siguen con sets hard-coded por roleKey (fase 4).
 */
@Injectable()
export class SaveRolePermissionMatrixHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly matrix: RolePermissionMatrixPort,
    private readonly roles: RoleRepositoryPort,
    private readonly scopes: MatrixScopeService,
    private readonly administratorGuard: AdministratorGuardService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: SaveRolePermissionMatrixCommand): Promise<SaveRolePermissionMatrixResult> {
    const context = await this.workContext.authorize({
      firebaseUid: command.actorFirebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.roleId, 'MANAGE_PERMISSIONS', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    const scope = await this.scopes.resolve(context.organizationId, command.scopeCompanyId, command.scopeBranchId);

    const saved = await this.transactionManager.run(
      async (tx) => {
        const activeRoles = await this.roles.listActive(context.organizationId, tx);
        const { editable, entries } = this.buildCompleteEntries(command.entries, activeRoles);
        // La segregacion de funciones se valida solo sobre lo editable: PLATFORM_ADMIN es fijo (todo permitido) por diseno.
        this.assertNoIncompatibleCombinations(editable, new Map(activeRoles.map((role) => [role.id, role.name])));

        await this.administratorGuard.assertMatrixKeepsAnAdministrator(
          context.organizationId,
          { version: 0, scope, entries },
          tx,
        );

        const previous = await this.matrix.getCurrentVersion(context.organizationId, scope, tx);
        const result = await this.matrix.saveNewVersion(context.organizationId, entries, command.actorFirebaseUid, scope, tx);

        await this.auditRepository.recordAdminEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.actorFirebaseUid,
            targetFirebaseUid: command.actorFirebaseUid,
            action: 'ROLE_PERMISSION_MATRIX_UPDATED',
            changes: {
              previousVersion: previous.version,
              newVersion: result.version,
              scope: { companyId: scope.companyId, branchId: scope.branchId },
            },
          },
          tx,
        );

        return result;
      },
      { isolationLevel: 'Serializable' },
    );

    return { ...saved, actionCatalog: PERMISSION_ACTION_CATALOG };
  }

  /**
   * Valida completitud exacta (roles activos x catalogo) y fija la fila de
   * PLATFORM_ADMIN. Devuelve la foto final a guardar.
   */
  private buildCompleteEntries(
    submitted: SaveRolePermissionMatrixCommand['entries'],
    activeRoles: { id: string; key: string | null }[],
  ): { editable: RolePermissionEntry[]; entries: RolePermissionEntry[] } {
    const platformAdmin = activeRoles.find((role) => role.key === PLATFORM_ADMIN_KEY);
    const editableRoleIds = new Set(activeRoles.filter((role) => role !== platformAdmin).map((role) => role.id));

    const received = new Map<string, RolePermissionEntry>();
    for (const entry of submitted) {
      if (platformAdmin && entry.roleId === platformAdmin.id) continue; // fila no editable: se ignora
      const cell = `${entry.roleId}:${actionKey(entry.module, entry.action)}`;
      if (received.has(cell)) {
        throw new BadRequestException({
          code: 'INCOMPLETE_MATRIX',
          detail: `La celda ${actionKey(entry.module, entry.action)} del rol ${entry.roleId} viene repetida.`,
        });
      }
      received.set(cell, { roleId: entry.roleId, module: entry.module, action: entry.action, allowed: entry.allowed });
    }

    const expected = new Set(
      [...editableRoleIds].flatMap((roleId) =>
        PERMISSION_ACTION_CATALOG.map((descriptor) => `${roleId}:${actionKey(descriptor.module, descriptor.action)}`),
      ),
    );
    if (expected.size !== received.size || [...expected].some((cell) => !received.has(cell))) {
      throw new BadRequestException({
        code: 'INCOMPLETE_MATRIX',
        detail:
          'La matriz debe incluir una celda por cada combinacion de rol activo y accion del catalogo (sin roles inactivos ni acciones desconocidas).',
      });
    }

    const editable = [...received.values()];
    const entries = [...editable];
    if (platformAdmin) {
      for (const descriptor of PERMISSION_ACTION_CATALOG) {
        entries.push({ roleId: platformAdmin.id, module: descriptor.module, action: descriptor.action, allowed: true });
      }
    }
    return { editable, entries };
  }

  private assertNoIncompatibleCombinations(entries: RolePermissionEntry[], roleNames: Map<string, string>): void {
    const allowedByRole = new Map<string, Set<string>>();
    for (const entry of entries) {
      if (!entry.allowed) continue;
      const key = actionKey(entry.module, entry.action);
      const set = allowedByRole.get(entry.roleId) ?? new Set<string>();
      set.add(key);
      allowedByRole.set(entry.roleId, set);
    }

    for (const [roleId, allowedActions] of allowedByRole) {
      for (const [first, second] of INCOMPATIBLE_ACTION_PAIRS) {
        if (allowedActions.has(first) && allowedActions.has(second)) {
          throw new ConflictException({
            code: 'INCOMPATIBLE_PERMISSIONS',
            detail: `El rol ${roleNames.get(roleId) ?? roleId} no puede tener habilitadas a la vez "${first}" y "${second}" (segregacion de funciones).`,
          });
        }
      }
    }
  }
}
