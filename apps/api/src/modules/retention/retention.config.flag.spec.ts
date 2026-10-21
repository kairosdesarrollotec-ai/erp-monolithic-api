import { isRetentionPurgeEnabled } from './retention.config';

/** DEC-OPS-FLAGS-001: RETENTION_PURGE_ENABLED usa el criterio comun (false|off|0|no = apagado, sin distinguir mayusculas). */
describe('isRetentionPurgeEnabled - criterio comun de interruptores', () => {
  it.each(['false', 'FALSE', 'off', 'Off', '0', 'no', ' NO '])('%p -> apagado', (v) => {
    expect(isRetentionPurgeEnabled({ RETENTION_PURGE_ENABLED: v })).toBe(false);
  });
  it.each([undefined, '', 'true', 'on', '1', 'yes'])('%p -> encendido (default)', (v) => {
    expect(isRetentionPurgeEnabled({ RETENTION_PURGE_ENABLED: v })).toBe(true);
  });
  it('bajo Jest nunca corre', () => {
    expect(isRetentionPurgeEnabled({ JEST_WORKER_ID: '1' })).toBe(false);
  });
});
