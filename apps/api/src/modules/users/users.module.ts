import { Module } from '@nestjs/common';
import { UsersController } from './presentation/http/users.controller';
import { GetActivationStatusHandler } from './application/queries/get-activation-status.handler';
import { CompleteActivationHandler } from './application/commands/complete-activation.handler';
import { GetWorkContextAssignmentsHandler } from './application/queries/get-work-context-assignments.handler';
import { SelectWorkContextHandler } from './application/commands/select-work-context.handler';
import { UserProfileRepositoryPort } from './application/ports/user-profile-repository.port';
import { WorkContextRepositoryPort } from './application/ports/work-context-repository.port';
import { PrismaUserProfileRepository } from './infrastructure/persistence/prisma-user-profile.repository';
import { PrismaWorkContextRepository } from './infrastructure/persistence/prisma-work-context.repository';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [UsersController],
  providers: [
    GetActivationStatusHandler,
    CompleteActivationHandler,
    GetWorkContextAssignmentsHandler,
    SelectWorkContextHandler,
    { provide: UserProfileRepositoryPort, useClass: PrismaUserProfileRepository },
    { provide: WorkContextRepositoryPort, useClass: PrismaWorkContextRepository },
  ],
})
export class UsersModule {}
