import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { UserProfileRepositoryPort } from '../../../users/application/ports/user-profile-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { IdentityLookupPort } from '../ports/identity-lookup.port';
import { AssignUserToCompanyCommand } from './assign-user-to-company.command';

/**
 * ADM-01 (Usuarios y asignaciones) - "Agregar usuario" / asignar
 * empresa-sede-rol.
 *
 * Si el correo no existe en Firebase, se crea la cuenta con la contraseña
 * inicial proporcionada (initialPassword) y requiresPasswordChange=true.
 * Al primer login, TR-02 obliga al usuario a cambiar la contraseña y
 * enrolar MFA antes de acceder a las rutas protegidas.
 *
 * Si el correo ya existe, se reutiliza el uid existente.
 *
 * Atomicidad: asignacion + auditoria corren en la misma transaccion.
 */
@Injectable()
export class AssignUserToCompanyHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly adminUsers: AdminUserRepositoryPort,
    private readonly identity: IdentityLookupPort,
    private readonly userProfiles: UserProfileRepositoryPort,
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

    let targetUid = await this.identity.findUidByEmail(command.targetEmail);

    if (!targetUid) {
      const provisioned = await this.identity.provisionUser(command.targetEmail, command.initialPassword);
      targetUid = provisioned.uid;
      await this.userProfiles.createProfile({
        firebaseUid: targetUid,
        organizationId: context.organizationId,
        requiresPasswordChange: true,
      });
    }

    const assignment = await this.transactionManager.run(async (tx) => {
      const result = await this.adminUsers.createOrReactivateAssignment(
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

      return result;
    });

    return { id: assignment.id };
  }
}
