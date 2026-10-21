-- Respaldan la purga de retencion por fecha (L-02): idempotency_keys.expires_at y outbox_events.dead_lettered_at.
-- (outbox_events.processed_at ya tiene indice.) Aditiva e idempotente.
CREATE INDEX IF NOT EXISTS "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");
CREATE INDEX IF NOT EXISTS "outbox_events_dead_lettered_at_idx" ON "outbox_events"("dead_lettered_at");
