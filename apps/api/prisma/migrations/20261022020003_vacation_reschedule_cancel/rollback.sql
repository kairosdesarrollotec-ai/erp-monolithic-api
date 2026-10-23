-- Rollback de 20261022020003_vacation_reschedule_cancel. Las filas REPROGRAMADA/CANCELADA conservan su estado y fechas vigentes; se pierden las fechas originales y el motivo.
ALTER TABLE "vacation_requests"
  DROP COLUMN IF EXISTS "status_changed_by_id",
  DROP COLUMN IF EXISTS "status_changed_at",
  DROP COLUMN IF EXISTS "status_reason",
  DROP COLUMN IF EXISTS "reschedule_count",
  DROP COLUMN IF EXISTS "original_end_date",
  DROP COLUMN IF EXISTS "original_start_date";
