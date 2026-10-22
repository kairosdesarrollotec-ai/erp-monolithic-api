-- Rollback de 20261022020002_attendance_self_service_geofence. Se pierden la geocerca de las sedes y los datos de marcas propias/revision.
DROP INDEX IF EXISTS "attendance_records_review_status_idx";
ALTER TABLE "attendance_records"
  DROP CONSTRAINT IF EXISTS "attendance_records_review_status_chk",
  DROP CONSTRAINT IF EXISTS "attendance_records_source_chk",
  DROP COLUMN IF EXISTS "check_out_distance_meters",
  DROP COLUMN IF EXISTS "check_out_outside_geofence",
  DROP COLUMN IF EXISTS "check_out_accuracy_meters",
  DROP COLUMN IF EXISTS "check_out_longitude",
  DROP COLUMN IF EXISTS "check_out_latitude",
  DROP COLUMN IF EXISTS "check_out_captured_at",
  DROP COLUMN IF EXISTS "review_note",
  DROP COLUMN IF EXISTS "reviewed_at",
  DROP COLUMN IF EXISTS "reviewed_by_id",
  DROP COLUMN IF EXISTS "review_status",
  DROP COLUMN IF EXISTS "geofence_radius_meters",
  DROP COLUMN IF EXISTS "distance_meters",
  DROP COLUMN IF EXISTS "outside_geofence",
  DROP COLUMN IF EXISTS "captured_at",
  DROP COLUMN IF EXISTS "on_behalf_reason",
  DROP COLUMN IF EXISTS "source";
ALTER TABLE "branches"
  DROP CONSTRAINT IF EXISTS "branches_geofence_chk",
  DROP COLUMN IF EXISTS "geofence_updated_at",
  DROP COLUMN IF EXISTS "geofence_updated_by",
  DROP COLUMN IF EXISTS "geofence_radius_meters",
  DROP COLUMN IF EXISTS "longitude",
  DROP COLUMN IF EXISTS "latitude";
