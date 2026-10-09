import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RecordLoginAttemptHandler } from '../../application/commands/record-login-attempt.handler';
import { RecordLoginAttemptCommand } from '../../application/commands/record-login-attempt.command';
import { RecordLoginAttemptDto } from './dto/record-login-attempt.dto';

@Controller('audit')
export class AuditController {
  constructor(private readonly recordLoginAttempt: RecordLoginAttemptHandler) {}

  // Endpoint público (sin FirebaseAuthGuard): registra intentos de login antes de que
  // el usuario tenga token. Límite estricto: 10 llamadas/minuto por IP para mitigar
  // flood de la tabla audit_events y enumeración de emails (OWASP A04).
  @Post('login-attempts')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async recordLogin(@Body() dto: RecordLoginAttemptDto): Promise<void> {
    await this.recordLoginAttempt.execute(
      new RecordLoginAttemptCommand(dto.email, dto.outcome, dto.reason ?? null),
    );
  }
}
