import { Logger } from '@nestjs/common';
import { RetentionPurgePort, RetentionTarget } from './retention-purge.port';
import { RetentionPurgeService } from './retention-purge.service';
import { loadRetentionConfig } from '../retention.config';

const NOW = new Date('2026-10-19T15:00:00.000Z');
const DAY = 86_400_000;

function setup(envOverrides: Record<string, string> = {}, returns: Record<string, number[]> = {}) {
  const calls: Array<{ target: RetentionTarget; cutoff: Date; limit: number }> = [];
  const queues = Object.fromEntries(Object.entries(returns).map(([k, v]) => [k, [...v]]));
  const port: RetentionPurgePort = {
    purgeBatch: jest.fn(async (target, cutoff, limit) => {
      calls.push({ target, cutoff, limit });
      return queues[target]?.shift() ?? 0;
    }),
  };
  const config = loadRetentionConfig({ RETENTION_PURGE_BATCH_SIZE: '3', ...envOverrides });
  const sleep = jest.fn(async () => undefined);
  const service = new RetentionPurgeService(port, { now: () => NOW }, config, sleep);
  return { service, port, calls, sleep };
}

describe('RetentionPurgeService (L-02)', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('usa 365 d por defecto y calcula el corte contra el reloj', async () => {
    const { service, calls } = setup();
    await service.run();
    expect(calls.map((c) => c.target)).toEqual(['IDEMPOTENCY_KEYS', 'OUTBOX_PROCESSED', 'OUTBOX_DEAD_LETTER', 'DASHBOARD_ITEMS_SEEN']);
    for (const c of calls.filter((x) => x.target !== 'DASHBOARD_ITEMS_SEEN')) expect(c.cutoff.getTime()).toBe(NOW.getTime() - 365 * DAY);
    // Items de tablero ya vistos: corte a 30 d; nada de evidencia se purga jamas.
    expect(calls.find((x) => x.target === 'DASHBOARD_ITEMS_SEEN')!.cutoff.getTime()).toBe(NOW.getTime() - 30 * DAY);
    expect(calls.some((x) => /EVIDENCE/.test(x.target))).toBe(false);
  });

  it('respeta plazos configurables por entorno', async () => {
    const { service, calls } = setup({
      RETENTION_IDEMPOTENCY_DAYS: '30',
      RETENTION_OUTBOX_PROCESSED_DAYS: '60',
      RETENTION_OUTBOX_DEAD_LETTER_DAYS: '90',
    });
    await service.run();
    expect(calls.map((c) => NOW.getTime() - c.cutoff.getTime())).toEqual([30 * DAY, 60 * DAY, 90 * DAY, 30 * DAY]);
  });

  it('borra por lotes hasta que un lote vuelve incompleto (nunca un DELETE gigante)', async () => {
    const { service, calls, sleep } = setup({}, { IDEMPOTENCY_KEYS: [3, 3, 1] });
    const [idem] = await service.run();
    expect(idem).toMatchObject({ deleted: 7, batches: 3, truncated: false });
    expect(calls.filter((c) => c.target === 'IDEMPOTENCY_KEYS').every((c) => c.limit === 3)).toBe(true);
    expect(sleep).toHaveBeenCalledTimes(2); // pausa entre lotes llenos, no tras el último
  });

  it('corta en maxBatchesPerRun y lo reporta como truncado', async () => {
    const { service } = setup({ RETENTION_PURGE_MAX_BATCHES_PER_RUN: '2' }, { OUTBOX_PROCESSED: [3, 3, 3, 3] });
    const results = await service.run();
    expect(results[1]).toMatchObject({ target: 'OUTBOX_PROCESSED', deleted: 6, batches: 2, truncated: true });
  });

  it('es idempotente: sin filas vencidas borra 0 y una segunda corrida también', async () => {
    const { service } = setup();
    expect((await service.run()).every((r) => r.deleted === 0)).toBe(true);
    expect((await service.run()).every((r) => r.deleted === 0 && r.batches === 1)).toBe(true);
  });

  it('un objetivo que falla no impide purgar los demás', async () => {
    const { service, port } = setup();
    (port.purgeBatch as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('db down');
    });
    const results = await service.run();
    expect(results[0].error).toBe('db down');
    expect(results[1].error).toBeUndefined();
    expect(port.purgeBatch).toHaveBeenCalledTimes(4);
  });

  it('el log estructurado trae solo conteos/plazos (sin datos personales) y hora de Lima', async () => {
    const { service } = setup({}, { IDEMPOTENCY_KEYS: [2] });
    await service.run();
    const payload = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({ event: 'retention.purge.run', totalDeleted: 2, startedAtLima: '2026-10-19 10:00:00 America/Lima' });
    expect(Object.keys(payload.targets[0]).sort()).toEqual(['batches', 'cutoff', 'deleted', 'retentionDays', 'target', 'truncated']);
  });
});
