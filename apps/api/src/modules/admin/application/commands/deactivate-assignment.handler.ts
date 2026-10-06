import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { AdministratorGuardService } from '../services/administrator-guard.service';
import { DeactivateAssignmentCommand } from './deactivate-assignment.command';

/**
 * ADM-01 - "dar de baja" (punto 10 del contrato: requiere confirmacion,
 * ya resuelta en el cliente antes de llamar a este endpoint). Nunca
 * borra la fila (ver AdminUserRepositoryPort.deactivateAssignment) - el
 * historial de auditoria (ADM-04) necesita conservar que la asignacion
 * existio.
 *
 * Hallazgo ALTO de revalidacion PR#7 ("ultimo administrador"): dar de
 * baja la unica asignacion ADMINISTRACION activa de la organizacion
 * dejaria a la organizacion sin nadie que pueda gestionar
 * usuarios/permisos (deadlock operativo, sin via de recuperacion desde
 * la propia aplicacion). El chequeo corre DENTRO de la misma transaccion
 * Serializable que la baja (conteo + baja atomicos) para que dos bajas
 * concurrentes del penultimo y ultimo administrador no puedan dejar la
 * organizacion en 0 administradores por una condicion de carrera.
 *
 * ROLES DINAMICOS: "administrador" ya no es el nombre ADMINISTRACION sino un
 * PERMISO: una asignacion vigente cuyo rol (activo) tiene a la vez
 * ADMIN.MANAGE_PERMISSIONS y ADMIN.MANAGE_USERS en su ambito
 * (AdministratorGuardService). El codigo de error se mantiene por contrato.
 */
@Injectable()
export class DeactivateAssignmentHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly adminUsers: AdminUserRepositoryPort,
    private readonly administratorGuard: AdministratorGuardService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: DeactivateAssignmentCommand): Promise<void> {
    const context = await this.workContext.authorize({
      firebaseUid: command.actorFirebaseUid,
      companyId: command.actorCompanyId,
      branchId: command.actorBranchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.roleId, 'MANAGE_USERS', { companyId: context.companyId, branchId: context.branchId });

    await this.transactionManager.run(
      async (tx) => {
        // Si esta asignacion es la UNICA administradora vigente de la organizacion, no se puede dar de baja.
        const administratorIds = await this.administratorGuard.administratorAssignmentIds(context.organizationId, tx);
        if (administratorIds.length === 1 && administratorIds[0] === command.assignmentId) {
          throw new ConflictException({
            code: 'LAST_ADMINISTRATOR_CANNOT_BE_DEACTIVATED',
            detail:
              'No se puede dar de baja: es la unica asignacion con permisos de administracion (gestionar permisos y usuarios) activa en la organizacion.',
          });
        }

        const deactivated = await this.adminUsers.deactivateAssignment(
          command.assignmentId,
          context.organizationId,
          tx,
        );
        if (!deactivated) {
          throw new NotFoundException('Asignacion no encontrada.');
        }

        await this.auditRepository.recordAdminEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.actorFirebaseUid,
            targetFirebaseUid: deactivated.firebaseUid,
            action: 'USER_ASSIGNMENT_DEACTIVATED',
            changes: { assignmentId: command.assignmentId },
          },
          tx,
        );
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
