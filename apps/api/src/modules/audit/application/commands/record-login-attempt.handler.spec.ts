import { RecordLoginAttemptHandler } from './record-login-attempt.handler';
import { RecordLoginAttemptCommand } from './record-login-attempt.command';
import { AuditEventRepositoryPort } from '../ports/audit-event-repository.port';

describe('RecordLoginAttemptHandler', () => {
  it('nunca envia la contrasena al repositorio, solo email/outcome/reason', async () => {
    const repository: jest.Mocked<AuditEventRepositoryPort> = {
      recordLoginAttempt: jest.fn().mockResolvedValue(undefined),
      recordWorkContextSelection: jest.fn().mockResolvedValue(undefined),
    };
    const handler = new RecordLoginAttemptHandler(repository);

    await handler.execute(
      new RecordLoginAttemptCommand('user@veloxrent.pe', 'FAILURE', 'invalid-credential'),
    );

    expect(repository.recordLoginAttempt).toHaveBeenCalledWith({
      organizationId: null,
      actorUserId: null,
      email: 'user@veloxrent.pe',
      outcome: 'FAILURE',
      reason: 'invalid-credential',
    });
  });

  it('registra intentos exitosos sin motivo', async () => {
    const repository: jest.Mocked<AuditEventRepositoryPort> = {
      recordLoginAttempt: jest.fn().mockResolvedValue(undefined),
      recordWorkContextSelection: jest.fn().mockResolvedValue(undefined),
    };
    const handler = new RecordLoginAttemptHandler(repository);

    await handler.execute(new RecordLoginAttemptCommand('user@veloxrent.pe', 'SUCCESS', null));

    expect(repository.recordLoginAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'SUCCESS', reason: null }),
    );
  });
});
