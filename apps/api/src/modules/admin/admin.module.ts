import { Module } from '@nestjs/common';
import { AdminController } from './presentation/http/admin.controller';
import { ListOrganizationUsersHandler } from './application/queries/list-organization-users.handler';
import { AssignUserToCompanyHandler } from './application/commands/assign-user-to-company.handler';
import { DeactivateAssignmentHandler } from './application/commands/deactivate-assignment.handler';
import { ListAuditEventsHandler } from './application/queries/list-audit-events.handler';
import { GetReservationDepositPolicyHandler } from './application/queries/get-reservation-deposit-policy.handler';
import { UpdateReservationDepositPolicyHandler } from './application/commands/update-reservation-deposit-policy.handler';
import { GetRolePermissionMatrixHandler } from './application/queries/get-role-permission-matrix.handler';
import { SaveRolePermissionMatrixHandler } from './application/commands/save-role-permission-matrix.handler';
import { RolePermissionMatrixPort } from './application/ports/role-permission-matrix.port';
import { GetNotificationTemplatesHandler } from './application/queries/get-notification-templates.handler';
import { SaveNotificationTemplateHandler } from './application/commands/save-notification-template.handler';
import { PrismaRolePermissionMatrixRepository } from './infrastructure/persistence/prisma-role-permission-matrix.repository';
import { AdminUserRepositoryPort } from './application/ports/admin-user-repository.port';
import { PrismaAdminUserRepository } from './infrastructure/persistence/prisma-admin-user.repository';
import { IdentityLookupPort } from './application/ports/identity-lookup.port';
import { FirebaseIdentityLookupAdapter } from './infrastructure/identity/firebase-identity-lookup.adapter';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { ParametersModule } from '../parameters/parameters.module';
import { NotificationTemplatesModule } from '../notification-templates/notification-templates.module';

/**
 * ADM-01 (Usuarios y asignaciones). Primera pantalla real del rol
 * Administracion del sistema (PANTALLAS-V2-B-SOPORTE.md) - ADM-02
 * (roles/permisos), ADM-03 (catalogos/parametros), ADM-04 (auditoria de
 * lectura) y ADM-05 (notificaciones) quedan para pasos siguientes, cada
 * uno con su propio alcance real (ver Decision Log / plan de trabajo del
 * Project KAIROS).
 */
@Module({
  imports: [UsersModule, AuditModule, ParametersModule, NotificationTemplatesModule],
  controllers: [AdminController],
  providers: [
    ListOrganizationUsersHandler,
    AssignUserToCompanyHandler,
    DeactivateAssignmentHandler,
    ListAuditEventsHandler,
    GetReservationDepositPolicyHandler,
    UpdateReservationDepositPolicyHandler,
    GetRolePermissionMatrixHandler,
    SaveRolePermissionMatrixHandler,
    GetNotificationTemplatesHandler,
    SaveNotificationTemplateHandler,
    { provide: AdminUserRepositoryPort, useClass: PrismaAdminUserRepository },
    { provide: IdentityLookupPort, useClass: FirebaseIdentityLookupAdapter },
    { provide: RolePermissionMatrixPort, useClass: PrismaRolePermissionMatrixRepository },
  ],
})
export class AdminModule {}
