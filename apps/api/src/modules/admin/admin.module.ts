import { Module } from '@nestjs/common';
import { AdminController } from './presentation/http/admin.controller';
import { ListOrganizationUsersHandler } from './application/queries/list-organization-users.handler';
import { AssignUserToCompanyHandler } from './application/commands/assign-user-to-company.handler';
import { DeactivateAssignmentHandler } from './application/commands/deactivate-assignment.handler';
import { AdminUserRepositoryPort } from './application/ports/admin-user-repository.port';
import { PrismaAdminUserRepository } from './infrastructure/persistence/prisma-admin-user.repository';
import { IdentityLookupPort } from './application/ports/identity-lookup.port';
import { FirebaseIdentityLookupAdapter } from './infrastructure/identity/firebase-identity-lookup.adapter';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

/**
 * ADM-01 (Usuarios y asignaciones). Primera pantalla real del rol
 * Administracion del sistema (PANTALLAS-V2-B-SOPORTE.md) - ADM-02
 * (roles/permisos), ADM-03 (catalogos/parametros), ADM-04 (auditoria de
 * lectura) y ADM-05 (notificaciones) quedan para pasos siguientes, cada
 * uno con su propio alcance real (ver Decision Log / plan de trabajo del
 * Project KAIROS).
 */
@Module({
  imports: [UsersModule, AuditModule],
  controllers: [AdminController],
  providers: [
    ListOrganizationUsersHandler,
    AssignUserToCompanyHandler,
    DeactivateAssignmentHandler,
    { provide: AdminUserRepositoryPort, useClass: PrismaAdminUserRepository },
    { provide: IdentityLookupPort, useClass: FirebaseIdentityLookupAdapter },
  ],
})
export class AdminModule {}
