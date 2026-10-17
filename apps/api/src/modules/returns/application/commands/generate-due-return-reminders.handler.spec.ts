import { GenerateDueReturnRemindersHandler, REMINDER_GENERATION_BATCH_SIZE } from './generate-due-return-reminders.handler';
import { buildDeps, FIXED_NOW } from '../../testing/return-test-fixtures';
import { ReminderCandidate } from '../ports/return-reminder-repository.port';

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    returnId: 'ret-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    scheduledAt: new Date('2026-10-05T14:00:00.000Z'),
    customerName: 'Juan Perez',
    vehiclePlate: 'ABC-123',
    ...overrides,
  };
}

describe('GenerateDueReturnRemindersHandler (BR-DEV-004 / DEC-DEV-REMINDER-001)', () => {
  it('busca devoluciones con hora pactada en [now-24h, now+3h] y crea los recordatorios PENDING con el texto', async () => {
    const deps = buildDeps();
    deps.reminders.findCandidates.mockResolvedValue([candidate()]);
    deps.reminders.createPending.mockResolvedValue(1);

    const result = await new GenerateDueReturnRemindersHandler(deps.reminders, deps.clock).execute();

    expect(result).toEqual({ candidates: 1, created: 1 });
    expect(deps.reminders.findCandidates).toHaveBeenCalledWith(
      new Date(FIXED_NOW.getTime() - 24 * 3_600_000),
      new Date(FIXED_NOW.getTime() + 3 * 3_600_000),
      REMINDER_GENERATION_BATCH_SIZE,
    );
    expect(deps.reminders.createPending).toHaveBeenCalledWith([
      expect.objectContaining({
        returnId: 'ret-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
        dueAt: new Date('2026-10-05T11:00:00.000Z'),
        messageText: expect.stringContaining('05/10/2026 a las 09:00 (hora de Lima)'),
      }),
    ]);
  });

  it('sin candidatas no escribe nada', async () => {
    const deps = buildDeps();
    const result = await new GenerateDueReturnRemindersHandler(deps.reminders, deps.clock).execute();
    expect(result).toEqual({ candidates: 0, created: 0 });
    expect(deps.reminders.createPending).not.toHaveBeenCalled();
  });

  it('es idempotente: si otra réplica ya las creó, created = 0 (skipDuplicates)', async () => {
    const deps = buildDeps();
    deps.reminders.findCandidates.mockResolvedValue([candidate(), candidate({ returnId: 'ret-2' })]);
    deps.reminders.createPending.mockResolvedValue(0);
    const result = await new GenerateDueReturnRemindersHandler(deps.reminders, deps.clock).execute();
    expect(result).toEqual({ candidates: 2, created: 0 });
  });

  it('NO envía nada ni toca el outbox: el envío es manual-asistido', async () => {
    const deps = buildDeps();
    deps.reminders.findCandidates.mockResolvedValue([candidate()]);
    await new GenerateDueReturnRemindersHandler(deps.reminders, deps.clock).execute();
    expect(deps.outboxRepository.publish).not.toHaveBeenCalled();
  });
});
