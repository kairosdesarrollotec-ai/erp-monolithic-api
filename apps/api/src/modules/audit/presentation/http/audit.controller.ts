import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { RecordLoginAttemptHandler } from '../../application/commands/record-login-attempt.handler';
import { RecordLoginAttemptCommand } from '../../application/commands/record-login-attempt.command';
import { RecordLoginAttemptDto } from './dto/record-login-attempt.dto';

@Controller('audit')
export class AuditController {
  constructor(private readonly recordLoginAttempt: RecordLoginAttemptHandler) {}

  @Post('login-attempts')
  @HttpCode(204)
  async recordLogin(@Body() dto: RecordLoginAttemptDto): Promise<void> {
    await this.recordLoginAttempt.execute(
      new RecordLoginAttemptCommand(dto.email, dto.outcome, dto.reason ?? null),
    );
  }
}
