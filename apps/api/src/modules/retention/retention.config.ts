/**
 * Configuración de la purga de retención (decisión L-02 del 16-oct-2026, DEC-RET-001..005 propuestos).
 * Todo se lee de variables de entorno (ver .env.example). Valores inválidos o por debajo del piso de seguridad
 * caen al default y se reportan en `warnings` (nunca se purga con un plazo accidentalmente corto, p. ej. "0").
 */
export const RETENTION_DEFAULTS = {
  idempotencyDays: 365,
  outboxProcessedDays: 365,
  outboxDeadLetterDays: 365,
  batchSize: 500,
  maxBatchesPerRun: 200,
  batchPauseMs: 100,
  intervalMs: 6 * 60 * 60_000,
  initialDelayMs: 5 * 60_000,
} as const;

/** Piso de seguridad de los plazos: una typo (0, 1, 30) no debe borrar historial reciente. */
export const RETENTION_MIN_DAYS = 7;
export const RETENTION_MAX_BATCH_SIZE = 5000;

export interface RetentionConfig {
  idempotencyDays: number;
  outboxProcessedDays: number;
  outboxDeadLetterDays: number;
  batchSize: number;
  maxBatchesPerRun: number;
  batchPauseMs: number;
  intervalMs: number;
  initialDelayMs: number;
  warnings: string[];
}

type Env = Record<string, string | undefined>;

function readInt(env: Env, name: string, def: number, min: number, max: number, warnings: string[]): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    warnings.push(`${name}=${raw} fuera de rango [${min}, ${max}]; se usa ${def}`);
    return def;
  }
  return n;
}

/** `RETENTION_PURGE_ENABLED=false|off|0` lo desactiva (default: activo). Nunca corre bajo Jest. */
export function isRetentionPurgeEnabled(env: Env = process.env): boolean {
  if (env.JEST_WORKER_ID !== undefined) return false;
  const v = (env.RETENTION_PURGE_ENABLED ?? '').trim().toLowerCase();
  return !['false', 'off', '0', 'no'].includes(v);
}

export function loadRetentionConfig(env: Env = process.env): RetentionConfig {
  const warnings: string[] = [];
  const d = RETENTION_DEFAULTS;
  const MAX_DAYS = 36_500;
  return {
    idempotencyDays: readInt(env, 'RETENTION_IDEMPOTENCY_DAYS', d.idempotencyDays, RETENTION_MIN_DAYS, MAX_DAYS, warnings),
    outboxProcessedDays: readInt(env, 'RETENTION_OUTBOX_PROCESSED_DAYS', d.outboxProcessedDays, RETENTION_MIN_DAYS, MAX_DAYS, warnings),
    outboxDeadLetterDays: readInt(env, 'RETENTION_OUTBOX_DEAD_LETTER_DAYS', d.outboxDeadLetterDays, RETENTION_MIN_DAYS, MAX_DAYS, warnings),
    batchSize: readInt(env, 'RETENTION_PURGE_BATCH_SIZE', d.batchSize, 1, RETENTION_MAX_BATCH_SIZE, warnings),
    maxBatchesPerRun: readInt(env, 'RETENTION_PURGE_MAX_BATCHES_PER_RUN', d.maxBatchesPerRun, 1, 100_000, warnings),
    batchPauseMs: readInt(env, 'RETENTION_PURGE_BATCH_PAUSE_MS', d.batchPauseMs, 0, 60_000, warnings),
    intervalMs: readInt(env, 'RETENTION_PURGE_INTERVAL_MS', d.intervalMs, 60_000, 7 * 24 * 60 * 60_000, warnings),
    initialDelayMs: readInt(env, 'RETENTION_PURGE_INITIAL_DELAY_MS', d.initialDelayMs, 0, 24 * 60 * 60_000, warnings),
    warnings,
  };
}
