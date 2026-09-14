import { Injectable } from '@nestjs/common';
import { AuditEventRepositoryPort } from '../ports/audit-event-repository.port';
import { RecordLoginAttemptCommand } from './record-login-attempt.command';

/**
 * TR-01: registra el intento de login como evento de auditoria.
 * Nunca recibe ni persiste la contrasena (ver DTO de presentacion).
 */
@Injectable()
export class RecordLoginAttemptHandler {
  constructor(private readonly repository: AuditEventRepositoryPort) {}

  async execute(command: RecordLoginAttemptCommand): Promise<void> {
    await this.repository.recordLoginAttempt({
      organizationId: null,
      actorUserId: null,
      email: command.email,
      outcome: command.outcome,
      reason: command.reason,
    });
  }
}
