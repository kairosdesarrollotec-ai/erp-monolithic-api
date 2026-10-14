import { ReturnReminderScheduler } from './return-reminder.scheduler';
import { GenerateDueReturnRemindersHandler } from '../../application/commands/generate-due-return-reminders.handler';

describe('ReturnReminderScheduler', () => {
  function build(execute: jest.Mock) {
    const handler = { execute } as unknown as GenerateDueReturnRemindersHandler;
    return new ReturnReminderScheduler(handler);
  }

  it('tick invoca la generación de recordatorios', async () => {
    const execute = jest.fn().mockResolvedValue({ candidates: 2, created: 2 });
    await build(execute).tick();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('un ciclo fallido no propaga el error (el siguiente ciclo reintenta)', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('db caída'));
    await expect(build(execute).tick()).resolves.toBeUndefined();
  });

  it('no solapa ciclos de este proceso', async () => {
    let release: () => void = () => undefined;
    const execute = jest.fn(
      () =>
        new Promise<{ candidates: number; created: number }>((resolve) => {
          release = () => resolve({ candidates: 0, created: 0 });
        }),
    );
    const scheduler = build(execute);
    const first = scheduler.tick();
    await scheduler.tick();
    expect(execute).toHaveBeenCalledTimes(1);
    release();
    await first;
    const third = scheduler.tick();
    expect(execute).toHaveBeenCalledTimes(2);
    release();
    await third;
  });

  it('bajo Jest nunca arranca el temporizador', () => {
    const scheduler = build(jest.fn());
    scheduler.onModuleInit();
    expect((scheduler as unknown as { timer?: unknown }).timer).toBeUndefined();
    scheduler.onModuleDestroy();
  });
});
