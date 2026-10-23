-- 22-oct-2026 (Respuestas Russbel #9): asistencia con autoservicio y control. Escrita A MANO (nunca `migrate dev`), ADITIVA.
--  1) branches: geocerca por sede (latitud/longitud WGS84 + radio en metros). NULL = sin geocerca configurada (la marca propia
--     se acepta y queda sin evaluar contra la sede; la ubicacion de la marca sigue siendo obligatoria).
--  2) attendance_records: origen de la marca (SELF = el colaborador desde su cuenta; ON_BEHALF = Personal a nombre de otro, con
--     motivo), hora capturada por el cliente (marcas offline), resultado de la geocerca y estado de revision (PENDING/APPROVED/
--     CORRECTED) cuando la marca quedo fuera de rango, y ubicacion/hora de la salida (check-out).
-- Los registros historicos quedan como ON_BEHALF (los registraba Personal) y sin revision.
ALTER TABLE "branches"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "geofence_radius_meters" INTEGER,
  ADD COLUMN "geofence_updated_by" TEXT,
  ADD COLUMN "geofence_updated_at" TIMESTAMP(3);

ALTER TABLE "branches"
  ADD CONSTRAINT "branches_geofence_chk" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL AND "geofence_radius_meters" IS NULL)
    OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180 AND "geofence_radius_meters" BETWEEN 10 AND 5000)
  );

ALTER TABLE "attendance_records"
  ADD COLUMN "source" VARCHAR(20) NOT NULL DEFAULT 'ON_BEHALF',
  ADD COLUMN "on_behalf_reason" TEXT,
  ADD COLUMN "captured_at" TIMESTAMP(3),
  ADD COLUMN "outside_geofence" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "distance_meters" DOUBLE PRECISION,
  ADD COLUMN "geofence_radius_meters" INTEGER,
  ADD COLUMN "review_status" VARCHAR(20),
  ADD COLUMN "reviewed_by_id" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "review_note" TEXT,
  ADD COLUMN "check_out_captured_at" TIMESTAMP(3),
  ADD COLUMN "check_out_latitude" DOUBLE PRECISION,
  ADD COLUMN "check_out_longitude" DOUBLE PRECISION,
  ADD COLUMN "check_out_accuracy_meters" DOUBLE PRECISION,
  ADD COLUMN "check_out_outside_geofence" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "check_out_distance_meters" DOUBLE PRECISION;

ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_source_chk" CHECK ("source" IN ('SELF', 'ON_BEHALF')),
  ADD CONSTRAINT "attendance_records_review_status_chk" CHECK ("review_status" IS NULL OR "review_status" IN ('PENDING', 'APPROVED', 'CORRECTED'));

-- Bandeja de revision: marcas pendientes por fecha.
CREATE INDEX "attendance_records_review_status_idx" ON "attendance_records"("review_status", "date");
