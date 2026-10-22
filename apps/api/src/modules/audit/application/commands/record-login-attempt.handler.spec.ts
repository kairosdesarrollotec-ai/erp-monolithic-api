import { RecordLoginAttemptHandler } from './record-login-attempt.handler';
import { RecordLoginAttemptCommand } from './record-login-attempt.command';
import { AuditEventRepositoryPort } from '../ports/audit-event-repository.port';
import { LoginFailureTrackerPort } from '../ports/login-failure-tracker.port';

const buildTracker = (attempts: Array<{ outcome: 'SUCCESS' | 'FAILURE' }> = [], raised = false) =>
  ({
    listAttemptsSince: jest.fn().mockResolvedValue(attempts),
    alertAlreadyRaised: jest.fn().mockResolvedValue(raised),
    resolveScopes: jest.fn().mockResolvedValue([{ organizationId: 'org-1', operatingCompanyId: 'co-1', branchId: 'br-1' }]),
    raiseAlert: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<LoginFailureTrackerPort>;

const buildRepo = () =>
  ({ recordLoginAttempt: jest.fn().mockResolvedValue(undefined) }) as unknown as jest.Mocked<AuditEventRepositoryPort>;
const failures = (n: number) => Array.from({ length: n }, () => ({ outcome: 'FAILURE' as const }));

describe('B8 - umbral de fallos de login (sin bloqueo de cuenta)', () => {
  const cmd = new RecordLoginAttemptCommand('user@veloxrent.pe', 'FAILURE', 'invalid-credential');

  it('con 10 fallos consecutivos alerta a Administracion una vez', async () => {
    const tracker = buildTracker(failures(10));
    await new RecordLoginAttemptHandler(buildRepo(), tracker).execute(cmd);
    expect(tracker.raiseAlert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@veloxrent.pe', failures: 10, windowMinutes: 15 }),
    );
  });

  it('con 9 fallos no alerta', async () => {
    const tracker = buildTracker(failures(9));
    await new RecordLoginAttemptHandler(buildRepo(), tracker).execute(cmd);
    expect(tracker.raiseAlert).not.toHaveBeenCalled();
  });

  it('un acceso exitoso corta la racha (9 fallos recientes + exito + fallos viejos)', async () => {
    const tracker = buildTracker([...failures(9), { outcome: 'SUCCESS' }, ...failures(5)]);
    await new RecordLoginAttemptHandler(buildRepo(), tracker).execute(cmd);
    expect(tracker.raiseAlert).not.toHaveBeenCalled();
  });

  it('no repite la alerta dentro de la misma ventana', async () => {
    const tracker = buildTracker(failures(12), true);
    await new RecordLoginAttemptHandler(buildRepo(), tracker).execute(cmd);
    expect(tracker.raiseAlert).not.toHaveBeenCalled();
  });

  it('un intento exitoso no evalua el umbral', async () => {
    const tracker = buildTracker(failures(12));
    await new RecordLoginAttemptHandler(buildRepo(), tracker).execute(new RecordLoginAttemptCommand('user@veloxrent.pe', 'SUCCESS', null));
    expect(tracker.listAttemptsSince).not.toHaveBeenCalled();
  });

  it('si la alerta falla, el intento igual queda registrado y no se propaga el error', async () => {
    const tracker = buildTracker(failures(10));
    tracker.raiseAlert.mockRejectedValue(new Error('db down'));
    const repo = buildRepo();
    await expect(new RecordLoginAttemptHandler(repo, tracker).execute(cmd)).resolves.toBeUndefined();
    expect(repo.recordLoginAttempt).toHaveBeenCalledTimes(1);
  });
});

describe('RecordLoginAttemptHandler', () => {
  it('nunca envia la contrasena al repositorio, solo email/outcome/reason', async () => {
    const repository: jest.Mocked<AuditEventRepositoryPort> = {
      recordLoginAttempt: jest.fn().mockResolvedValue(undefined),
      recordWorkContextSelection: jest.fn().mockResolvedValue(undefined),
      recordReservationEvent: jest.fn().mockResolvedValue(undefined),
      recordInquiryEvent: jest.fn().mockResolvedValue(undefined),
      recordAdminEvent: jest.fn().mockResolvedValue(undefined),
      recordRentalEvent: jest.fn().mockResolvedValue(undefined),
      recordIncidentEvent: jest.fn(),
      recordFleetEvent: jest.fn(),
      recordRecruitmentEvent: jest.fn(),
      recordHrAdministrationEvent: jest.fn(),
    };
    const handler = new RecordLoginAttemptHandler(repository, buildTracker());

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
      recordReservationEvent: jest.fn().mockResolvedValue(undefined),
      recordInquiryEvent: jest.fn().mockResolvedValue(undefined),
      recordAdminEvent: jest.fn().mockResolvedValue(undefined),
      recordRentalEvent: jest.fn().mockResolvedValue(undefined),
      recordIncidentEvent: jest.fn(),
      recordFleetEvent: jest.fn(),
      recordRecruitmentEvent: jest.fn(),
      recordHrAdministrationEvent: jest.fn(),
    };
    const handler = new RecordLoginAttemptHandler(repository, buildTracker());

    await handler.execute(new RecordLoginAttemptCommand('user@veloxrent.pe', 'SUCCESS', null));

    expect(repository.recordLoginAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'SUCCESS', reason: null }),
    );
  });
});
