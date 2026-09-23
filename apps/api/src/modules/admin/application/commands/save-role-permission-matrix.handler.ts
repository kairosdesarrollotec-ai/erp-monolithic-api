import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RolePermissionMatrixPort, RolePermissionMatrixSnapshot } from '../ports/role-permission-matrix.port';
import { actionKey, INCOMPATIBLE_ACTION_PAIRS, PERMISSION_ACTION_CATALOG } from '../../domain/permission-action-catalog';
import { assertAdminRoleAllowed } from '../policies/admin-role-policy';
import { SaveRolePermissionMatrixCommand } from './save-role-permission-matrix.command';
import { WORKER_ROLES } from '../../../users/domain/worker-role';

/**
 * ADM-02 - "Guardar cambios" de la matriz (contrato punto 7). Regla
 * "Solo una version vigente a la vez" (punto 9, igual criterio que
 * ADM-03): esta accion siempre INSERTA una foto completa nueva, nunca
 * edita filas existentes - el historial queda completo (punto 11).
 *
 * Segregacion de funciones (punto 8): valida INCOMPATIBLE_ACTION_PAIRS
 * antes de guardar - si un mismo rol queda con `allowed: true` en las 2
 * acciones de un par incompatible, rechaza con 409 explicando cual es
 * el conflicto (mismo criterio del ejemplo del contrato UX: "el sistema
 * lo bloquea con explicacion").
 *
 * NOTA DE ALCANCE (ver role-permission-matrix.port.ts): esto guarda la
 * matriz para verla/auditarla - todavia NO reemplaza el enforcement de
 * los `*-role-policy.ts` existentes en cada handler.
 */
@Injectable()
export class SaveRolePermissionMatrixHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrix: RolePermissionMatrixPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: SaveRolePermissionMatrixCommand): Promise<RolePermissionMatrixSnapshot> {
    const context = await this.workContext.authorize({
      firebaseUid: command.actorFirebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    assertAdminRoleAllowed(context.role, 'MANAGE_PERMISSIONS');

    this.assertCompleteMatrix(command.entries);
    this.assertNoIncompatibleCombinations(command.entries);

    const previous = await this.matrix.getCurrentVersion(context.organizationId);

    const saved = await this.transactionManager.run(async (tx) => {
      const result = await this.matrix.saveNewVersion(context.organizationId, command.entries, command.actorFirebaseUid, tx);

      await this.auditRepository.recordAdminEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.actorFirebaseUid,
          targetFirebaseUid: command.actorFirebaseUid,
          action: 'ROLE_PERMISSION_MATRIX_UPDATED',
          changes: { previousVersion: previous.version, newVersion: result.version },
        },
        tx,
      );

      return result;
    });

    return saved;
  }

  private assertCompleteMatrix(entries: SaveRolePermissionMatrixCommand['entries']): void {
    const expected = new Set(WORKER_ROLES.flatMap((role) => PERMISSION_ACTION_CATALOG.map((descriptor) => `${role}:${actionKey(descriptor.module, descriptor.action)}`)));
    const received = new Set(entries.map((entry) => `${entry.role}:${actionKey(entry.module, entry.action)}`));
    if (expected.size !== received.size || [...expected].some((key) => !received.has(key))) {
      throw new BadRequestException({
        code: 'INCOMPLETE_MATRIX',
        detail: 'La matriz debe incluir una celda por cada combinacion de rol y accion del catalogo.',
      });
    }
  }

  private assertNoIncompatibleCombinations(entries: SaveRolePermissionMatrixCommand['entries']): void {
    const allowedByRole = new Map<string, Set<string>>();
    for (const entry of entries) {
      if (!entry.allowed) continue;
      const key = actionKey(entry.module, entry.action);
      const set = allowedByRole.get(entry.role) ?? new Set<string>();
      set.add(key);
      allowedByRole.set(entry.role, set);
    }

    for (const [role, allowedActions] of allowedByRole) {
      for (const [first, second] of INCOMPATIBLE_ACTION_PAIRS) {
        if (allowedActions.has(first) && allowedActions.has(second)) {
          throw new ConflictException({
            code: 'INCOMPATIBLE_PERMISSIONS',
            detail: `El rol ${role} no puede tener habilitadas a la vez "${first}" y "${second}" (segregacion de funciones).`,
          });
        }
      }
    }
  }
}
