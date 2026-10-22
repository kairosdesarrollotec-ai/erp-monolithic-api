-- HU-29 (Respuestas 2026-10-20 #20): ubicacion automatica OPCIONAL al registrar asistencia (WGS84, precision en metros). Aditiva.
ALTER TABLE "attendance_records"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "accuracy_meters" DOUBLE PRECISION;
