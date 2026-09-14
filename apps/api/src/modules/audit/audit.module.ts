import { Module } from '@nestjs/common';
import { AuditController } from './presentation/http/audit.controller';
import { RecordLoginAttemptHandler } from './application/commands/record-login-attempt.handler';
import { AuditEventRepositoryPort } from './application/ports/audit-event-repository.port';
import { PrismaAuditEventRepository } from './infrastructure/persistence/prisma-audit-event.repository';

@Module({
  controllers: [AuditController],
  providers: [
    RecordLoginAttemptHandler,
    { provide: AuditEventRepositoryPort, useClass: PrismaAuditEventRepository },
  ],
})
export class AuditModule {}
