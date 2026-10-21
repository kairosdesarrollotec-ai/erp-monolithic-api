-- DEC-ALQ-DRIVERRATE-001 (F-02, respuesta de Russbel 19-oct-2026): tarifa diaria del conductor de la empresa digitable
-- a mano por alquiler (prioridad: valor manual > env COMPANY_DRIVER_DAILY_RATE > "tarifa no definida").
-- Aditiva e idempotente: columna NULL (NULL = sin valor manual) con CHECK >= 0.
ALTER TABLE "rentals" ADD COLUMN IF NOT EXISTS "company_driver_daily_rate" DECIMAL(10,2);

ALTER TABLE "rentals" DROP CONSTRAINT IF EXISTS "rentals_company_driver_daily_rate_check";
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_company_driver_daily_rate_check"
  CHECK ("company_driver_daily_rate" IS NULL OR "company_driver_daily_rate" >= 0);
