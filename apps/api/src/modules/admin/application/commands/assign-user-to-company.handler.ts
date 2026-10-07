import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { UserProfileRepositoryPort } from '../../../users/application/ports/user-profile-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { RoleRepositoryPort } from '../ports/role-repository.port';
import { RoleNotAssignableError } from '../../domain/role-errors';
import { IdentityLookupPort } from '../ports/identity-lookup.port';
import { EmailNotificationPort } from '../ports/email-notification.port';
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
 * ROLES DINAMICOS: `targetRoleId` debe ser un rol ACTIVO de la organizacion
 * del administrador (400 ROLE_NOT_ASSIGNABLE si no existe, esta inactivo o es
 * de otra organizacion - no se distingue, IDOR). Se valida ANTES de crear la
 * cuenta en Firebase para no dejar usuarios huerfanos. Solo se escribe
 * role_id (la columna enum `role` esta deprecada).
 *
 * Atomicidad: asignacion + auditoria corren en la misma transaccion.
 */
@Injectable()
export class AssignUserToCompanyHandler {
  private readonly logger = new Logger(AssignUserToCompanyHandler.name);

  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly adminUsers: AdminUserRepositoryPort,
    private readonly roles: RoleRepositoryPort,
    private readonly identity: IdentityLookupPort,
    private readonly userProfiles: UserProfileRepositoryPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly emailNotification: EmailNotificationPort,
  ) {}

  async execute(command: AssignUserToCompanyCommand): Promise<{ id: string }> {
    const context = await this.workContext.authorize({
      firebaseUid: command.actorFirebaseUid,
      companyId: command.actorCompanyId,
      branchId: command.actorBranchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.roleId, 'MANAGE_USERS', { companyId: context.companyId, branchId: context.branchId });

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

    const targetRole = await this.roles.findById(command.targetRoleId, context.organizationId);
    if (!targetRole || !targetRole.active) {
      throw new RoleNotAssignableError();
    }

    const existingUid = await this.identity.findUidByEmail(command.targetEmail);
    const isNewUser = !existingUid;
    let resolvedUid: string;

    if (isNewUser) {
      if (!command.initialPassword) {
        throw new BadRequestException({
          code: 'INITIAL_PASSWORD_REQUIRED',
          detail: 'El correo no existe todavia - se requiere una contrasena inicial para crear la cuenta.',
        });
      }
      const provisioned = await this.identity.provisionUser(command.targetEmail, command.initialPassword);
      resolvedUid = provisioned.uid;
      await this.userProfiles.createProfile({
        firebaseUid: resolvedUid,
        organizationId: context.organizationId,
        requiresPasswordChange: true,
      });
    } else {
      resolvedUid = existingUid;
    }

    const assignment = await this.transactionManager.run(async (tx) => {
      const result = await this.adminUsers.createOrReactivateAssignment(
        {
          organizationId: context.organizationId,
          firebaseUid: resolvedUid,
          companyId: command.targetCompanyId,
          branchId: command.targetBranchId,
          roleId: targetRole.id,
        },
        tx,
      );

      await this.auditRepository.recordAdminEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.actorFirebaseUid,
          targetFirebaseUid: resolvedUid,
          action: 'USER_ASSIGNMENT_CREATED_OR_REACTIVATED',
          changes: {
            targetEmail: command.targetEmail,
            companyId: command.targetCompanyId,
            branchId: command.targetBranchId,
            roleId: targetRole.id,
            roleName: targetRole.name,
            roleKey: targetRole.key,
          },
        },
        tx,
      );

      return result;
    });

    if (isNewUser) {
      void this.emailNotification
        .sendWelcomeUser(command.targetEmail, command.initialPassword!)
        .catch((err: unknown) =>
          this.logger.error('Welcome email failed to send', { email: command.targetEmail, error: err }),
        );
    }

    return { id: assignment.id };
  }
}
