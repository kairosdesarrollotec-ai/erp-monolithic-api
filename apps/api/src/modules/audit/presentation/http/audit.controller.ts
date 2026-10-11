import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RecordLoginAttemptHandler } from '../../application/commands/record-login-attempt.handler';
import { RecordLoginAttemptCommand } from '../../application/commands/record-login-attempt.command';
import { RecordLoginAttemptDto } from './dto/record-login-attempt.dto';
import { Public } from '../../../../common/decorators/public.decorator';

@Controller('audit')
export class AuditController {
  constructor(private readonly recordLoginAttempt: RecordLoginAttemptHandler) {}

  @Public()
  @Post('login-attempts')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async recordLogin(@Body() dto: RecordLoginAttemptDto): Promise<void> {
    await this.recordLoginAttempt.execute(
      new RecordLoginAttemptCommand(dto.email, dto.outcome, dto.reason ?? null),
    );
  }
}
