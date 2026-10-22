import { Module } from '@nestjs/common';
import { AuditController } from './presentation/http/audit.controller';
import { RecordLoginAttemptHandler } from './application/commands/record-login-attempt.handler';
import { AuditEventRepositoryPort } from './application/ports/audit-event-repository.port';
import { AuditEventQueryPort } from './application/ports/audit-event-query.port';
import { LoginFailureTrackerPort } from './application/ports/login-failure-tracker.port';
import { PrismaLoginFailureTracker } from './infrastructure/persistence/prisma-login-failure-tracker';
import { PrismaAuditEventRepository } from './infrastructure/persistence/prisma-audit-event.repository';

@Module({
  controllers: [AuditController],
  providers: [
    RecordLoginAttemptHandler,
    { provide: AuditEventRepositoryPort, useClass: PrismaAuditEventRepository },
    { provide: LoginFailureTrackerPort, useClass: PrismaLoginFailureTracker },
    { provide: AuditEventQueryPort, useExisting: AuditEventRepositoryPort },
  ],
  // AuditEventRepositoryPort se reutiliza fuera de este modulo (p.ej.
  // TR-05/HU-23 audita la seleccion de contexto de trabajo) - ver
  // TDD-KAIROS-TRANSVERSAL.md 7.3, audit_events es transversal a los 6
  // modulos.
  exports: [AuditEventRepositoryPort, AuditEventQueryPort],
})
export class AuditModule {}
