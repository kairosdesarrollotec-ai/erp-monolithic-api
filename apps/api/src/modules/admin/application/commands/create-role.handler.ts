import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { RoleRepositoryPort, RoleWithAssignmentCount } from '../ports/role-repository.port';
import { normalizeRoleName } from '../../domain/role-name';
import { CreateRoleCommand } from './create-role.command';

/**
 * ADM-02 - POST /admin/roles. Crea un rol NO de sistema, activo, version 1 y
 * con CERO permisos (deny-by-default: no tiene ninguna entrada en la matriz
 * hasta que el administrador la guarde). Nombre unico por organizacion sin
 * distinguir mayusculas (409 ROLE_NAME_TAKEN, lo garantiza el indice unico
 * funcional de la base), 1..60 caracteres tras recortar espacios (400
 * ROLE_NAME_INVALID). Audita ROLE_CREATED en la misma transaccion.
 *
 * Idempotencia: reintentar la misma creacion devuelve 409 ROLE_NAME_TAKEN (el
 * nombre es la clave natural); como el resto de los comandos de Administracion
 * no usa Idempotency-Key.
 */
@Injectable()
export class CreateRoleHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly roles: RoleRepositoryPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: CreateRoleCommand): Promise<RoleWithAssignmentCount> {
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
      const role = await this.roles.create({ organizationId: context.organizationId, name }, tx);

      await this.auditRepository.recordAdminEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.actorFirebaseUid,
          targetFirebaseUid: command.actorFirebaseUid,
          entityType: 'role',
          entityId: role.id,
          action: 'ROLE_CREATED',
          changes: { roleId: role.id, name: role.name },
        },
        tx,
      );

      return { ...role, assignmentCount: 0 };
    });
  }
}
