import { ReturnAlertScheduler } from './return-alert.scheduler';
import { PublishReturnDashboardAlertsHandler } from '../../application/commands/publish-return-dashboard-alerts.handler';

describe('ReturnAlertScheduler (DEC-DEVREM-002)', () => {
  function build(execute: jest.Mock) {
    return new ReturnAlertScheduler({ execute } as unknown as PublishReturnDashboardAlertsHandler);
  }

  it('tick invoca la publicación de alertas', async () => {
    const execute = jest.fn().mockResolvedValue({ candidates: 2, created: 1, dismissed: 0 });
    await build(execute).tick();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('un ciclo fallido no propaga el error ni registra el mensaje de la base (puede traer datos)', async () => {
    const scheduler = build(jest.fn().mockRejectedValue(new Error('valor sensible Juan Perez 999888777')));
    const errorSpy = jest.spyOn((scheduler as unknown as { logger: { error: (m: string) => void } }).logger, 'error').mockImplementation(() => undefined);
    await expect(scheduler.tick()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).not.toMatch(/Juan|999888777|sensible/);
  });

  it('no solapa ciclos de este proceso', async () => {
    let release: () => void = () => undefined;
    const execute = jest.fn(
      () => new Promise<{ candidates: number; created: number; dismissed: number }>((resolve) => { release = () => resolve({ candidates: 0, created: 0, dismissed: 0 }); }),
    );
    const scheduler = build(execute);
    const first = scheduler.tick();
    await scheduler.tick();
    expect(execute).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  it('bajo Jest nunca arranca el temporizador', () => {
    const scheduler = build(jest.fn());
    scheduler.onModuleInit();
    expect((scheduler as unknown as { timer?: unknown }).timer).toBeUndefined();
    scheduler.onModuleDestroy();
  });

  it('RETURN_ALERT_SCHEDULER=off tampoco arranca (aunque no sea Jest)', () => {
    const jestId = process.env.JEST_WORKER_ID;
    delete process.env.JEST_WORKER_ID;
    process.env.RETURN_ALERT_SCHEDULER = 'off';
    try {
      const scheduler = build(jest.fn());
      scheduler.onModuleInit();
      expect((scheduler as unknown as { timer?: unknown }).timer).toBeUndefined();
    } finally {
      delete process.env.RETURN_ALERT_SCHEDULER;
      process.env.JEST_WORKER_ID = jestId;
    }
  });
});
