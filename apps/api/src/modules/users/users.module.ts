import { Module } from '@nestjs/common';
import { UsersController } from './presentation/http/users.controller';
import { GetActivationStatusHandler } from './application/queries/get-activation-status.handler';
import { CompleteActivationHandler } from './application/commands/complete-activation.handler';
import { GetWorkContextAssignmentsHandler } from './application/queries/get-work-context-assignments.handler';
import { SelectWorkContextHandler } from './application/commands/select-work-context.handler';
import { WorkContextAuthorizationService } from './application/services/work-context-authorization.service';
import { GetDashboardHandler } from './application/queries/get-dashboard.handler';
import { GetMyProfileHandler } from './application/queries/get-my-profile.handler';
import { UserProfileRepositoryPort } from './application/ports/user-profile-repository.port';
import { WorkContextRepositoryPort } from './application/ports/work-context-repository.port';
import { PrismaUserProfileRepository } from './infrastructure/persistence/prisma-user-profile.repository';
import { PrismaWorkContextRepository } from './infrastructure/persistence/prisma-work-context.repository';
import { AuditModule } from '../audit/audit.module';
import { DashboardProjectionsModule } from '../dashboard-projections/dashboard-projections.module';

@Module({
  imports: [AuditModule, DashboardProjectionsModule],
  controllers: [UsersController],
  providers: [
    GetActivationStatusHandler,
    CompleteActivationHandler,
    GetWorkContextAssignmentsHandler,
    SelectWorkContextHandler,
    WorkContextAuthorizationService,
    GetDashboardHandler,
    GetMyProfileHandler,
    { provide: UserProfileRepositoryPort, useClass: PrismaUserProfileRepository },
    { provide: WorkContextRepositoryPort, useClass: PrismaWorkContextRepository },
  ],
  // WorkContextAuthorizationService se exporta para que otros modulos
  // (Reservations/HU-27 y los que sigan - Alquiler, Devolucion, etc.,
  // hallazgo medio PR#4 "logica futura duplicada", hallazgo alto PR#6
  // "no usa el servicio central") lo reutilicen importando UsersModule,
  // en vez de reimplementar su propia version de esta politica o llamar
  // directamente a WorkContextRepositoryPort.
  exports: [WorkContextAuthorizationService, UserProfileRepositoryPort],
})
export class UsersModule {}
