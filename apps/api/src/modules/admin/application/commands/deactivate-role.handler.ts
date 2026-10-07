import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { AdministratorGuardService } from '../services/administrator-guard.service';
import { RoleRepositoryPort, RoleWithAssignmentCount } from '../ports/role-repository.port';
import { PLATFORM_ADMIN_KEY } from '../../domain/system-roles';
import {
  RoleHasActiveAssignmentsError,
  RoleNotEditableError,
  RoleNotFoundError,
  RoleVersionConflictError,
} from '../../domain/role-errors';
import { DeactivateRoleCommand } from './deactivate-role.command';

/**
 * ADM-02 - POST /admin/roles/{id}/deactivate. NUNCA borra (conserva el
 * historial: asignaciones pasadas, matrices guardadas, auditoria). Guardas, en
 * orden: permiso (403) -> el rol existe en MI organizacion (404, IDOR) ->
 * no es PLATFORM_ADMIN (403 ROLE_NOT_EDITABLE) -> version (412
 * VERSION_CONFLICT) -> sin asignaciones activas (409
 * ROLE_HAS_ACTIVE_ASSIGNMENTS) -> la organizacion conserva un rol
 * administrador (409 LAST_ADMINISTRATOR_ROLE, red de seguridad por permisos).
 * Todo en una transaccion Serializable. Desactivar un rol ya inactivo es
 * idempotente a nivel de version (el segundo intento recibe 412).
 */
@Injectable()
export class DeactivateRoleHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly roles: RoleRepositoryPort,
    private readonly administratorGuard: AdministratorGuardService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: DeactivateRoleCommand): Promise<RoleWithAssignmentCount> {
    const context = await this.workContext.authorize({
      firebaseUid: command.actorFirebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.roleId, 'MANAGE_PERMISSIONS', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    return this.transactionManager.run(
      async (tx) => {
        const existing = await this.roles.findById(command.roleId, context.organizationId, tx);
        if (!existing) throw new RoleNotFoundError();
        if (existing.key === PLATFORM_ADMIN_KEY) throw new RoleNotEditableError();
        if (existing.version !== command.expectedVersion) throw new RoleVersionConflictError();

        const assignmentCount = await this.roles.countActiveAssignments(existing.id, context.organizationId, tx);
        if (assignmentCount > 0) throw new RoleHasActiveAssignmentsError(assignmentCount);

        await this.administratorGuard.assertRoleDeactivationKeepsAnAdministrator(context.organizationId, existing.id, tx);

        const deactivated = await this.roles.deactivate(
          { id: existing.id, organizationId: context.organizationId, expectedVersion: command.expectedVersion },
          tx,
        );
        if (!deactivated) throw new RoleVersionConflictError();

        await this.auditRepository.recordAdminEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.actorFirebaseUid,
            targetFirebaseUid: command.actorFirebaseUid,
            entityType: 'role',
            entityId: deactivated.id,
            action: 'ROLE_DEACTIVATED',
            changes: { roleId: deactivated.id, name: deactivated.name, version: deactivated.version },
          },
          tx,
        );

        return { ...deactivated, assignmentCount: 0 };
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
