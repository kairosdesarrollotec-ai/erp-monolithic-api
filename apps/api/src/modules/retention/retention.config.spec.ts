import { isRetentionPurgeEnabled, loadRetentionConfig, RETENTION_DEFAULTS } from './retention.config';

describe('retention.config', () => {
  it('defaults: 365 d en los tres plazos', () => {
    const c = loadRetentionConfig({});
    expect([c.idempotencyDays, c.outboxProcessedDays, c.outboxDeadLetterDays]).toEqual([365, 365, 365]);
    expect(c.warnings).toEqual([]);
  });

  it('valores inválidos o bajo el piso de 7 días caen al default con advertencia', () => {
    const c = loadRetentionConfig({ RETENTION_IDEMPOTENCY_DAYS: '0', RETENTION_PURGE_BATCH_SIZE: 'abc', RETENTION_OUTBOX_PROCESSED_DAYS: '3' });
    expect(c.idempotencyDays).toBe(365);
    expect(c.outboxProcessedDays).toBe(365);
    expect(c.batchSize).toBe(RETENTION_DEFAULTS.batchSize);
    expect(c.warnings).toHaveLength(3);
  });

  it('acepta valores válidos', () => {
    expect(loadRetentionConfig({ RETENTION_IDEMPOTENCY_DAYS: '90', RETENTION_PURGE_BATCH_SIZE: '100' })).toMatchObject({ idempotencyDays: 90, batchSize: 100 });
  });

  it('habilitación: activo por defecto, false/off/0 lo apagan y Jest nunca corre', () => {
    expect(isRetentionPurgeEnabled({})).toBe(true);
    expect(isRetentionPurgeEnabled({ RETENTION_PURGE_ENABLED: 'false' })).toBe(false);
    expect(isRetentionPurgeEnabled({ RETENTION_PURGE_ENABLED: 'OFF' })).toBe(false);
    expect(isRetentionPurgeEnabled({ JEST_WORKER_ID: '1' })).toBe(false);
  });
});
