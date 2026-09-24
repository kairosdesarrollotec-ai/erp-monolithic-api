import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { IdentityLookupPort } from '../ports/identity-lookup.port';
import { AssignUserToCompanyCommand } from './assign-user-to-company.command';

/**
 * ADM-01 (Usuarios y asignaciones) - "Agregar usuario" / asignar
 * empresa-sede-rol. BR implicita del contrato ("denegacion por
 * defecto"): esta es la UNICA forma de darle a un usuario cualquier
 * permiso en KAIROS - antes de este comando, un firebaseUid autenticado
 * no puede hacer nada (WorkContextAuthorizationService ya lo garantiza,
 * al no encontrar ninguna asignacion vigente).
 *
 * Mismo criterio de atomicidad que ConfirmReservationHandler: la
 * asignacion y su auditoria corren en la misma transaccion.
 */
@Injectable()
export class AssignUserToCompanyHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly adminUsers: AdminUserRepositoryPort,
    private readonly identity: IdentityLookupPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: AssignUserToCompanyCommand): Promise<{ id: string }> {
    const context = await this.workContext.authorize({
      firebaseUid: command.actorFirebaseUid,
      companyId: command.actorCompanyId,
      branchId: command.actorBranchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.role, 'MANAGE_USERS');

    const targetUid = await this.identity.findUidByEmail(command.targetEmail);
    if (!targetUid) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND_IN_IDENTITY_PROVIDER',
        detail:
          'No existe una cuenta de Firebase Authentication con ese correo. ADM-01 asigna empresa/sede/rol a una cuenta ya existente, no crea cuentas nuevas.',
      });
    }

    const ownership = await this.adminUsers.findCompanyBranchOwnership(
      context.organizationId,
      command.targetCompanyId,
      command.targetBranchId,
    );
    if (!ownership) {
      throw new BadRequestException({
        code: 'COMPANY_BRANCH_NOT_IN_ORGANIZATION',
        detail: 'La empresa/sede indicada no pertenece a la organizacion del administrador.',
      });
    }

    return this.transactionManager.run(async (tx) => {
      const assignment = await this.adminUsers.createOrReactivateAssignment(
        {
          organizationId: context.organizationId,
          firebaseUid: targetUid,
          companyId: command.targetCompanyId,
          branchId: command.targetBranchId,
          role: command.targetRole,
        },
        tx,
      );

      await this.auditRepository.recordAdminEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.actorFirebaseUid,
          targetFirebaseUid: targetUid,
          action: 'USER_ASSIGNMENT_CREATED_OR_REACTIVATED',
          changes: {
            targetEmail: command.targetEmail,
            companyId: command.targetCompanyId,
            branchId: command.targetBranchId,
            role: command.targetRole,
          },
        },
        tx,
      );

      return assignment;
    });
  }
}
