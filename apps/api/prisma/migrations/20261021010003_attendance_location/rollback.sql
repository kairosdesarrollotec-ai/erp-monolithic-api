-- Rollback de 20261021010003_attendance_location.
ALTER TABLE "attendance_records"
  DROP COLUMN IF EXISTS "latitude",
  DROP COLUMN IF EXISTS "longitude",
  DROP COLUMN IF EXISTS "accuracy_meters";
