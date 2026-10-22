import { Injectable, Logger } from '@nestjs/common';
import { AuditEventRepositoryPort } from '../ports/audit-event-repository.port';
import { LoginFailureTrackerPort } from '../ports/login-failure-tracker.port';
import { RecordLoginAttemptCommand } from './record-login-attempt.command';
import {
  LOGIN_FAILURE_ALERT_THRESHOLD,
  LOGIN_FAILURE_WINDOW_MINUTES,
  countConsecutiveFailures,
  loginFailureWindowStart,
  shouldRaiseLoginFailureAlert,
} from '../../domain/login-failure-policy';

/**
 * TR-01: registra el intento de login como evento de auditoria.
 * Nunca recibe ni persiste la contrasena (ver DTO de presentacion).
 *
 * B8: NO bloquea la cuenta. Tras un FAILURE, si el mismo identificador acumula >= 10 fallos consecutivos
 * en 15 min, se alerta a Administracion (una vez por ventana). La alerta es "best effort": un fallo al
 * emitirla nunca debe romper el registro del intento.
 */
@Injectable()
export class RecordLoginAttemptHandler {
  private readonly logger = new Logger(RecordLoginAttemptHandler.name);

  constructor(
    private readonly repository: AuditEventRepositoryPort,
    private readonly tracker: LoginFailureTrackerPort,
  ) {}

  async execute(command: RecordLoginAttemptCommand): Promise<void> {
    await this.repository.recordLoginAttempt({
      organizationId: null,
      actorUserId: null,
      email: command.email,
      outcome: command.outcome,
      reason: command.reason,
    });
    if (command.outcome !== 'FAILURE') return;
    try {
      await this.evaluateThreshold(command.email, this.tracker);
    } catch (err) {
      this.logger.error(`No se pudo evaluar la alerta de fallos de login: ${(err as Error).message}`);
    }
  }

  private async evaluateThreshold(email: string, tracker: LoginFailureTrackerPort): Promise<void> {
    const now = new Date();
    const since = loginFailureWindowStart(now);
    const attempts = await tracker.listAttemptsSince(email, since, LOGIN_FAILURE_ALERT_THRESHOLD + 5);
    const failures = countConsecutiveFailures(attempts);
    if (failures < LOGIN_FAILURE_ALERT_THRESHOLD) return;
    const raised = await tracker.alertAlreadyRaised(email, since);
    if (!shouldRaiseLoginFailureAlert(failures, raised)) return;
    const scopes = await tracker.resolveScopes(email);
    await tracker.raiseAlert({ email, failures, windowMinutes: LOGIN_FAILURE_WINDOW_MINUTES, scopes, now });
  }
}
