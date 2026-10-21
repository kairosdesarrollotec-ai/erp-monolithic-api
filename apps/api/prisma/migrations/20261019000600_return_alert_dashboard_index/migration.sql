-- DEC-DEVREM-002: respalda la reconciliacion del job de alertas de garantia (busca los dashboard_items activos de origen RETURN).
-- Aditiva e idempotente. La idempotencia de la propia alerta usa el indice unico existente (source_event_id, item_type).
CREATE INDEX IF NOT EXISTS "idx_dashboard_items_source_active" ON "dashboard_items"("source_type", "dismissed_at");
