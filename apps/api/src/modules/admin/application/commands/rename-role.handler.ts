import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { RoleRepositoryPort, RoleWithAssignmentCount } from '../ports/role-repository.port';
import { normalizeRoleName } from '../../domain/role-name';
import { PLATFORM_ADMIN_KEY } from '../../domain/system-roles';
import { RoleNotEditableError, RoleNotFoundError, RoleVersionConflictError } from '../../domain/role-errors';
import { RenameRoleCommand } from './rename-role.command';

/**
 * ADM-02 - PATCH /admin/roles/{id}. Renombra un rol con concurrencia
 * optimista (If-Match = version del rol: 412 VERSION_CONFLICT si cambio; 428
 * si falta, ya resuelto en el controller). Orden de las guardas: permiso
 * (403) -> nombre valido (400) -> el rol existe en MI organizacion (404, IDOR)
 * -> no es PLATFORM_ADMIN (403 ROLE_NOT_EDITABLE) -> version (412) -> nombre
 * libre (409 ROLE_NAME_TAKEN, por el indice unico funcional).
 *
 * Los roles de sistema (salvo PLATFORM_ADMIN) SI se renombran: la `key` es la
 * identidad estable, el `name` es solo visible. Audita ROLE_RENAMED.
 */
@Injectable()
export class RenameRoleHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly roles: RoleRepositoryPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: RenameRoleCommand): Promise<RoleWithAssignmentCount> {
    const context = await this.workContext.authorize({
      firebaseUid: command.actorFirebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.roleId, 'MANAGE_PERMISSIONS', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    const name = normalizeRoleName(command.name);

    return this.transactionManager.run(async (tx) => {
      const existing = await this.roles.findById(command.roleId, context.organizationId, tx);
      if (!existing) throw new RoleNotFoundError();
      if (existing.key === PLATFORM_ADMIN_KEY) throw new RoleNotEditableError();
      if (existing.version !== command.expectedVersion) throw new RoleVersionConflictError();

      const renamed = await this.roles.rename(
        { id: existing.id, organizationId: context.organizationId, expectedVersion: command.expectedVersion, name },
        tx,
      );
      if (!renamed) throw new RoleVersionConflictError();

      await this.auditRepository.recordAdminEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.actorFirebaseUid,
          targetFirebaseUid: command.actorFirebaseUid,
          entityType: 'role',
          entityId: renamed.id,
          action: 'ROLE_RENAMED',
          changes: { roleId: renamed.id, previousName: existing.name, newName: renamed.name, version: renamed.version },
        },
        tx,
      );

      const assignmentCount = await this.roles.countActiveAssignments(renamed.id, context.organizationId, tx);
      return { ...renamed, assignmentCount };
    });
  }
}
