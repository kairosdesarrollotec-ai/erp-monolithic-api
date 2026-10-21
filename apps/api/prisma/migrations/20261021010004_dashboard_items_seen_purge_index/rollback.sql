-- Rollback de 20261021010004_dashboard_items_seen_purge_index.
DROP INDEX IF EXISTS "dashboard_items_dismissed_at_idx";
