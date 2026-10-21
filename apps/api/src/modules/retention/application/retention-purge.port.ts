export type RetentionTarget = 'IDEMPOTENCY_KEYS' | 'OUTBOX_PROCESSED' | 'OUTBOX_DEAD_LETTER';

/**
 * Borra como máximo `limit` filas de `target` anteriores a `cutoff` y devuelve cuántas borró.
 * Debe ser seguro entre instancias concurrentes (filas disjuntas) e idempotente.
 */
export abstract class RetentionPurgePort {
  abstract purgeBatch(target: RetentionTarget, cutoff: Date, limit: number): Promise<number>;
}
