import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ProbationAlertScheduler } from './probation-alert.scheduler';

describe('ProbationAlertScheduler', () => {
  let service: any;
  let scheduler: ProbationAlertScheduler;

  beforeEach(() => {
    service = {
      run: jest.fn().mockResolvedValue({ candidatesChecked: 5, alertsCreated: 2 }),
    };
    scheduler = new ProbationAlertScheduler(service);
  });

  afterEach(() => {
    scheduler.onModuleDestroy();
  });

  it('no inicia timer bajo Jest (JEST_WORKER_ID)', () => {
    scheduler.onModuleInit();
    expect((scheduler as any).timer).toBeUndefined();
  });

  it('tick ejecuta el servicio y registra resultados', async () => {
    await scheduler.tick();
    expect(service.run).toHaveBeenCalledTimes(1);
  });

  it('tick no se solapa si ya está corriendo', async () => {
    let resolveFirst: () => void;
    service.run.mockReturnValueOnce(
      new Promise<any>((resolve) => {
        resolveFirst = () => resolve({ candidatesChecked: 1, alertsCreated: 1 });
      }),
    );

    const firstPromise = scheduler.tick();
    const secondPromise = scheduler.tick();

    expect(service.run).toHaveBeenCalledTimes(1);

    resolveFirst!();
    await Promise.all([firstPromise, secondPromise]);
  });
});
