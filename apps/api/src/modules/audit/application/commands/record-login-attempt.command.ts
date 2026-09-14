import type { LoginAttemptOutcome } from '../../domain/login-attempt-outcome';

export class RecordLoginAttemptCommand {
  constructor(
    public readonly email: string,
    public readonly outcome: LoginAttemptOutcome,
    public readonly reason: string | null,
  ) {}
}
