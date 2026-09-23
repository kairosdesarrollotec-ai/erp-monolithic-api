import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { assertAdminRoleAllowed } from '../policies/admin-role-policy';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { DeactivateAssignmentCommand } from './deactivate-assignment.command';

/**
 * ADM-01 - "dar de baja" (punto 10 del contrato: requiere confirmacion,
 * ya resuelta en el cliente antes de llamar a este endpoint). Nunca
 * borra la fila (ver AdminUserRepositoryPort.deactivateAssignment) - el
 * historial de auditoria (ADM-04) necesita conservar que la asignacion
 * existio.
 */
@Injectable()
export class DeactivateAssignmentHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
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
    assertAdminRoleAllowed(context.role, 'MANAGE_USERS');

    await this.transactionManager.run(async (tx) => {
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
    });
  }
}
