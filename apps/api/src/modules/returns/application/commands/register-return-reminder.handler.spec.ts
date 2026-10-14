import { ForbiddenException } from '@nestjs/common';
import { RegisterReturnReminderHandler } from './register-return-reminder.handler';
import { RegisterReturnReminderCommand } from './register-return-reminder.command';
import {
  InvalidReturnReminderResultError,
  ReturnNotFoundError,
  ReturnReminderAlreadySentError,
  ReturnReminderNotFoundError,
  ReturnReminderVersionConflictError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import { buildDeps, buildReminder, buildReturnRecord, FIXED_NOW, fakeTx, TEST_SCOPE } from '../../testing/return-test-fixtures';

describe('RegisterReturnReminderHandler (BR-DEV-004 / DAT-DEV-001)', () => {
  function build(role: 'FRONT_OFFICE' | 'AUDITORIA' = 'FRONT_OFFICE') {
    const deps = buildDeps({ role });
    deps.returns.findById.mockResolvedValue(buildReturnRecord());
    deps.reminders.findByReturnId.mockResolvedValue(buildReminder());
    deps.reminders.registerResult.mockImplementation(async (input) =>
      buildReminder({
        status: input.status,
        sentAt: input.sentAt,
        sentBy: input.sentBy,
        resultNote: input.resultNote,
        attempts: 1,
        version: input.expectedVersion + 1,
      }),
    );
    const handler = new RegisterReturnReminderHandler(
      deps.access,
      deps.returns,
      deps.reminders,
      deps.transactionManager,
      deps.clock,
      deps.auditRepository,
    );
    return { deps, handler };
  }
  const cmd = (over: Partial<{ result: 'SENT' | 'FAILED'; sentAt: Date; note: string; version: number }> = {}) =>
    new RegisterReturnReminderCommand(
      'ret-1',
      'uid-1',
      'comp-1',
      'branch-1',
      over.version ?? 1,
      over.result ?? 'SENT',
      over.sentAt,
      over.note,
    );

  it('registra ENVIADO con la hora actual por defecto y audita (sin tocar la versión del expediente)', async () => {
    const { deps, handler } = build();
    const { reminder } = await handler.execute(cmd({ note: 'Enviado por WhatsApp Web' }));

    expect(reminder).toMatchObject({ status: 'SENT', sentAt: FIXED_NOW, sentBy: 'uid-1', version: 2 });
    expect(deps.reminders.registerResult).toHaveBeenCalledWith(
      {
        returnId: 'ret-1',
        scope: TEST_SCOPE,
        expectedVersion: 1,
        status: 'SENT',
        sentAt: FIXED_NOW,
        sentBy: 'uid-1',
        resultNote: 'Enviado por WhatsApp Web',
      },
      fakeTx,
    );
    expect(deps.returns.update).not.toHaveBeenCalled();
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ rentalId: 'rent-1', action: 'RETURN_REMINDER_SENT' }),
      fakeTx,
    );
  });

  it('acepta una hora de envío explícita en el pasado', async () => {
    const { deps, handler } = build();
    const sentAt = new Date('2026-10-05T09:10:00.000Z');
    await handler.execute(cmd({ sentAt }));
    expect(deps.reminders.registerResult).toHaveBeenCalledWith(expect.objectContaining({ sentAt }), fakeTx);
  });

  it('FALLIDO exige nota con el motivo y queda auditado como RETURN_REMINDER_FAILED', async () => {
    const { deps, handler } = build();
    await expect(handler.execute(cmd({ result: 'FAILED' }))).rejects.toThrow(InvalidReturnReminderResultError);
    await expect(handler.execute(cmd({ result: 'FAILED', note: '   ' }))).rejects.toThrow(InvalidReturnReminderResultError);
    expect(deps.reminders.registerResult).not.toHaveBeenCalled();

    const { reminder } = await handler.execute(cmd({ result: 'FAILED', note: 'No contestó' }));
    expect(reminder.status).toBe('FAILED');
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RETURN_REMINDER_FAILED' }),
      fakeTx,
    );
  });

  it('rechaza una hora de envío en el futuro (más allá de 5 min de tolerancia de reloj)', async () => {
    const { handler } = build();
    await expect(handler.execute(cmd({ sentAt: new Date(FIXED_NOW.getTime() + 10 * 60_000) }))).rejects.toThrow(
      InvalidReturnReminderResultError,
    );
    await expect(handler.execute(cmd({ sentAt: new Date(FIXED_NOW.getTime() + 2 * 60_000) }))).resolves.toBeDefined();
  });

  it('un recordatorio FALLIDO admite reintento; uno ENVIADO es definitivo (409)', async () => {
    const { deps, handler } = build();
    deps.reminders.findByReturnId.mockResolvedValue(buildReminder({ status: 'FAILED', attempts: 1, version: 2, sentAt: FIXED_NOW }));
    await expect(handler.execute(cmd({ version: 2 }))).resolves.toBeDefined();

    deps.reminders.findByReturnId.mockResolvedValue(buildReminder({ status: 'SENT', version: 2, sentAt: FIXED_NOW }));
    await expect(handler.execute(cmd({ version: 2 }))).rejects.toThrow(ReturnReminderAlreadySentError);
  });

  it('If-Match desactualizado -> ReturnReminderVersionConflictError (412)', async () => {
    const { deps, handler } = build();
    const error = await handler.execute(cmd({ version: 7 })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReturnReminderVersionConflictError);
    expect((error as ReturnReminderVersionConflictError).httpStatus).toBe(412);
    expect(deps.reminders.registerResult).not.toHaveBeenCalled();
  });

  it('sin recordatorio generado -> 404; devolución inexistente -> 404; CANCELADA -> 409', async () => {
    const { deps, handler } = build();
    deps.reminders.findByReturnId.mockResolvedValue(null);
    await expect(handler.execute(cmd())).rejects.toThrow(ReturnReminderNotFoundError);

    deps.returns.findById.mockResolvedValue(null);
    await expect(handler.execute(cmd())).rejects.toThrow(ReturnNotFoundError);

    deps.returns.findById.mockResolvedValue(buildReturnRecord({ status: 'CANCELADA' }));
    await expect(handler.execute(cmd())).rejects.toThrow(ReturnStateConflictError);
  });

  it('rol sin permiso de crear/programar devoluciones (AUDITORIA) -> 403', async () => {
    const { handler } = build('AUDITORIA');
    await expect(handler.execute(cmd())).rejects.toThrow(ForbiddenException);
  });
});
