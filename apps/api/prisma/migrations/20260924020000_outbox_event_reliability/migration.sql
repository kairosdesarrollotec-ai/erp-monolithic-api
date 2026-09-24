-- Hallazgo ALTO de revalidacion PR#7 ("outbox sin fiabilidad real"):
-- OutboxRelayService hacia polling en un unico proceso, sin columnas
-- para reclamar eventos de forma segura entre replicas, sin backoff
-- (reintento inmediato indefinido) y sin cola de muertos (DLQ) para un
-- evento que nunca puede proyectarse. EXPAND puro - todas las columnas
-- nuevas son opcionales o tienen default, ninguna fila existente queda
-- inconsistente ni requiere backfill.
ALTER TABLE "outbox_events" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "outbox_events" ADD COLUMN "locked_until" TIMESTAMP(3);
ALTER TABLE "outbox_events" ADD COLUMN "last_error" TEXT;
ALTER TABLE "outbox_events" ADD COLUMN "dead_lettered_at" TIMESTAMP(3);

-- Indice que respalda el claim atomico (WHERE processed_at IS NULL AND
-- dead_lettered_at IS NULL AND (locked_until IS NULL OR locked_until <
-- now()) ORDER BY created_at ASC ... FOR UPDATE SKIP LOCKED).
CREATE INDEX "outbox_events_claim_idx"
  ON "outbox_events"("aggregate_type", "processed_at", "dead_lettered_at", "locked_until", "created_at");
