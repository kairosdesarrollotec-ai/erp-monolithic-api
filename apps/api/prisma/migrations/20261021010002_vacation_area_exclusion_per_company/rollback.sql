-- Rollback de 20261021010002: vuelve a la exclusion por area (sin empresa). Puede fallar si ya existen solapes entre empresas.
DROP INDEX IF EXISTS "vacation_requests_company_area_status_idx";
ALTER TABLE "vacation_requests" DROP CONSTRAINT IF EXISTS "vacation_requests_area_no_overlap_excl";
ALTER TABLE "vacation_requests"
ADD CONSTRAINT "vacation_requests_area_no_overlap_excl"
EXCLUDE USING gist ("area_id" WITH =, daterange("start_date", "end_date", '[]') WITH &&)
WHERE ("status" IN ('PROGRAMADA', 'REPROGRAMADA'));
ALTER TABLE "vacation_requests" DROP COLUMN IF EXISTS "operating_company_id";
