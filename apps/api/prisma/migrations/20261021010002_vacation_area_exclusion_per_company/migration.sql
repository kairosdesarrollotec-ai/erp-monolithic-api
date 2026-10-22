-- BR-ADP-002 por EMPRESA (Respuestas 2026-10-20 #18): el cupo "1 persona por area en fechas solapadas" deja de cruzar empresas que
-- comparten el mismo codigo de area. Escrita A MANO. Pasos: columna nullable -> backfill desde employees -> NOT NULL ->
-- se reemplaza la EXCLUDE (area+fechas) por (empresa+area+fechas).
ALTER TABLE "vacation_requests" ADD COLUMN "operating_company_id" TEXT;

UPDATE "vacation_requests" v
SET "operating_company_id" = e."operating_company_id"
FROM "employees" e
WHERE e."id" = v."employee_id";

ALTER TABLE "vacation_requests" ALTER COLUMN "operating_company_id" SET NOT NULL;

ALTER TABLE "vacation_requests" DROP CONSTRAINT "vacation_requests_area_no_overlap_excl";

ALTER TABLE "vacation_requests"
ADD CONSTRAINT "vacation_requests_area_no_overlap_excl"
EXCLUDE USING gist (
    "operating_company_id" WITH =,
    "area_id" WITH =,
    daterange("start_date", "end_date", '[]') WITH &&
)
WHERE ("status" IN ('PROGRAMADA', 'REPROGRAMADA'));

CREATE INDEX "vacation_requests_company_area_status_idx"
ON "vacation_requests"("operating_company_id", "area_id", "status", "start_date", "end_date");
