import { Module } from '@nestjs/common';
import { UsersController } from './presentation/http/users.controller';
import { GetActivationStatusHandler } from './application/queries/get-activation-status.handler';
import { CompleteActivationHandler } from './application/commands/complete-activation.handler';
import { UserProfileRepositoryPort } from './application/ports/user-profile-repository.port';
import { PrismaUserProfileRepository } from './infrastructure/persistence/prisma-user-profile.repository';

@Module({
  controllers: [UsersController],
  providers: [
    GetActivationStatusHandler,
    CompleteActivationHandler,
    { provide: UserProfileRepositoryPort, useClass: PrismaUserProfileRepository },
  ],
})
export class UsersModule {}
