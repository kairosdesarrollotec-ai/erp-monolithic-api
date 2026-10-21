import { Module } from '@nestjs/common';
import { AdminController } from './presentation/http/admin.controller';
import { MePermissionsController } from './presentation/http/me-permissions.controller';
import { ListOrganizationUsersHandler } from './application/queries/list-organization-users.handler';
import { GetOrganizationCompaniesHandler } from './application/queries/get-organization-companies.handler';
import { AssignUserToCompanyHandler } from './application/commands/assign-user-to-company.handler';
import { DeactivateAssignmentHandler } from './application/commands/deactivate-assignment.handler';
import { ListAuditEventsHandler } from './application/queries/list-audit-events.handler';
import { GetReservationDepositPolicyHandler } from './application/queries/get-reservation-deposit-policy.handler';
import { UpdateReservationDepositPolicyHandler } from './application/commands/update-reservation-deposit-policy.handler';
import { GetRolePermissionMatrixHandler } from './application/queries/get-role-permission-matrix.handler';
import { SaveRolePermissionMatrixHandler } from './application/commands/save-role-permission-matrix.handler';
import { GetNotificationTemplatesHandler } from './application/queries/get-notification-templates.handler';
import { SaveNotificationTemplateHandler } from './application/commands/save-notification-template.handler';
import { ListRolesHandler } from './application/queries/list-roles.handler';
import { GetMyPermissionsHandler } from './application/queries/get-my-permissions.handler';
import { CreateRoleHandler } from './application/commands/create-role.handler';
import { RenameRoleHandler } from './application/commands/rename-role.handler';
import { DeactivateRoleHandler } from './application/commands/deactivate-role.handler';
import { RoleRepositoryPort } from './application/ports/role-repository.port';
import { PrismaRoleRepository } from './infrastructure/persistence/prisma-role.repository';
import { AdministratorGuardService } from './application/services/administrator-guard.service';
import { MatrixScopeService } from './application/services/matrix-scope.service';
import { AdminUserRepositoryPort } from './application/ports/admin-user-repository.port';
import { PrismaAdminUserRepository } from './infrastructure/persistence/prisma-admin-user.repository';
import { IdentityLookupPort } from './application/ports/identity-lookup.port';
import { FirebaseIdentityLookupAdapter } from './infrastructure/identity/firebase-identity-lookup.adapter';
import { UsersModule } from '../users/users.module';
import { RecentAuthGuard } from '../users/infrastructure/auth/recent-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { ParametersModule } from '../parameters/parameters.module';
import { NotificationTemplatesModule } from '../notification-templates/notification-templates.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AdminMatrixAuthorizationService } from './application/services/admin-matrix-authorization.service';
import { EmailNotificationPort } from './application/ports/email-notification.port';
import { MatrixCatalogSyncService } from './infrastructure/persistence/matrix-catalog-sync.service';
import { ResendEmailAdapter } from './infrastructure/email/resend-email.adapter';

/**
 * ADM-01 (Usuarios y asignaciones). Primera pantalla real del rol
 * Administracion del sistema (PANTALLAS-V2-B-SOPORTE.md) - ADM-02
 * (roles/permisos), ADM-03 (catalogos/parametros), ADM-04 (auditoria de
 * lectura) y ADM-05 (notificaciones) quedan para pasos siguientes, cada
 * uno con su propio alcance real (ver Decision Log / plan de trabajo del
 * Project KAIROS).
 */
@Module({
  imports: [UsersModule, AuditModule, ParametersModule, NotificationTemplatesModule, AuthorizationModule],
  controllers: [AdminController, MePermissionsController],
  providers: [
    RecentAuthGuard,
    ListOrganizationUsersHandler,
    GetOrganizationCompaniesHandler,
    AssignUserToCompanyHandler,
    DeactivateAssignmentHandler,
    ListAuditEventsHandler,
    GetReservationDepositPolicyHandler,
    UpdateReservationDepositPolicyHandler,
    GetRolePermissionMatrixHandler,
    SaveRolePermissionMatrixHandler,
    ListRolesHandler,
    CreateRoleHandler,
    RenameRoleHandler,
    DeactivateRoleHandler,
    GetMyPermissionsHandler,
    GetNotificationTemplatesHandler,
    SaveNotificationTemplateHandler,
    AdminMatrixAuthorizationService,
    AdministratorGuardService,
    MatrixScopeService,
    MatrixCatalogSyncService,
    { provide: RoleRepositoryPort, useClass: PrismaRoleRepository },
    { provide: AdminUserRepositoryPort, useClass: PrismaAdminUserRepository },
    { provide: IdentityLookupPort, useClass: FirebaseIdentityLookupAdapter },
    { provide: EmailNotificationPort, useClass: ResendEmailAdapter },
  ],
})
export class AdminModule {}
