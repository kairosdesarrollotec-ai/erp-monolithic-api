-- BR-ADP-002 por EMPRESA (23-oct-2026): El cupo de vacaciones pasa a ser "1 persona por empresa en fechas solapadas".
-- Se reemplaza la EXCLUDE (empresa + area + fechas) por EXCLUDE (empresa + fechas).

ALTER TABLE "vacation_requests"
  DROP CONSTRAINT IF EXISTS "vacation_requests_area_no_overlap_excl";

ALTER TABLE "vacation_requests"
  ADD CONSTRAINT "vacation_requests_company_no_overlap_excl"
  EXCLUDE USING gist (
      "operating_company_id" WITH =,
      daterange("start_date", "end_date", '[]') WITH &&
  )
  WHERE ("status" IN ('PROGRAMADA', 'REPROGRAMADA'));
