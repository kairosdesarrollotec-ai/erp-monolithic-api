import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
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
 */
@Injectable()
export class DeactivateAssignmentHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly adminUsers: AdminUserRepositoryPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: DeactivateAssignmentCommand): Promise<void> {
    const context = await this.workContext.authorize({
      firebaseUid: command.actorFirebaseUid,
      companyId: command.actorCompanyId,
      branchId: command.actorBranchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.role, 'MANAGE_USERS');

    await this.transactionManager.run(
      async (tx) => {
        const deactivated = await this.adminUsers.deactivateAssignment(
          command.assignmentId,
          context.organizationId,
          tx,
        );
        if (!deactivated) {
          throw new NotFoundException('Asignacion no encontrada.');
        }

        if (deactivated.role === 'ADMINISTRACION') {
          const remainingActiveAdmins = await this.adminUsers.countActiveByRole(
            context.organizationId,
            'ADMINISTRACION',
            tx,
          );
          if (remainingActiveAdmins === 0) {
            throw new ConflictException({
              code: 'LAST_ADMINISTRATOR_CANNOT_BE_DEACTIVATED',
              detail:
                'No se puede dar de baja: es la unica asignacion con rol ADMINISTRACION activa en la organizacion.',
            });
          }
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
