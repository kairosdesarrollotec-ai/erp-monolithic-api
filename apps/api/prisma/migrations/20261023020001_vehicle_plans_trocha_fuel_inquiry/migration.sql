-- DEC-FLT-TROCHA-001 / DEC-FLT-PLANS-001 / DEC-CON-TROCHA-001 (23-oct-2026)
-- Agrega soporte de trocha, tarifas de los 3 planes de alquiler (Normal, Plus, Libre), penalidad por linea de combustible en vehiculos,
-- flag is_dirt_road en inquiries, y plan en quotations.

ALTER TABLE "vehicles"
  ADD COLUMN "suitable_for_trocha" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rate_normal" NUMERIC(10, 2),
  ADD COLUMN "rate_plus" NUMERIC(10, 2),
  ADD COLUMN "rate_libre" NUMERIC(10, 2),
  ADD COLUMN "fuel_penalty_per_line" NUMERIC(10, 2);

-- Backfill de tarifas iniciales y multa por combustible segun tarifario VR.01 (08/08/2026)
UPDATE "vehicles" SET "rate_normal" = 130, "rate_plus" = 160, "rate_libre" = 280, "fuel_penalty_per_line" = 40 WHERE "model" ILIKE '%Q22%';
UPDATE "vehicles" SET "rate_normal" = 160, "rate_plus" = 190, "rate_libre" = 310, "fuel_penalty_per_line" = 40 WHERE "model" ILIKE '%Accent%';
UPDATE "vehicles" SET "rate_normal" = 180, "rate_plus" = 210, "rate_libre" = 330, "fuel_penalty_per_line" = 40 WHERE "model" ILIKE '%Verna%';
UPDATE "vehicles" SET "rate_normal" = 190, "rate_plus" = 220, "rate_libre" = 340, "fuel_penalty_per_line" = 50, "suitable_for_trocha" = true WHERE "model" ILIKE '%Mahindra%';
UPDATE "vehicles" SET "rate_normal" = 200, "rate_plus" = 230, "rate_libre" = 350, "fuel_penalty_per_line" = 50, "suitable_for_trocha" = true WHERE "model" ILIKE '%Terios%';
UPDATE "vehicles" SET "rate_normal" = 250, "rate_plus" = 280, "rate_libre" = 400, "fuel_penalty_per_line" = 50, "suitable_for_trocha" = true WHERE "model" ILIKE '%Hilux%';
UPDATE "vehicles" SET "rate_normal" = 270, "rate_plus" = 300, "rate_libre" = 420, "fuel_penalty_per_line" = 50 WHERE "model" ILIKE '%Spin%';
UPDATE "vehicles" SET "rate_normal" = 300, "rate_plus" = 330, "rate_libre" = 450, "fuel_penalty_per_line" = 50 WHERE "model" ILIKE '%H1%';

-- Fallback para cualquier otro vehiculo existente
UPDATE "vehicles"
SET "rate_normal" = COALESCE("rate_normal", "daily_rate", 150),
    "rate_plus" = COALESCE("rate_plus", "daily_rate" + 30, 180),
    "rate_libre" = COALESCE("rate_libre", "daily_rate" + 150, 300),
    "fuel_penalty_per_line" = COALESCE("fuel_penalty_per_line", 50)
WHERE "rate_normal" IS NULL;

ALTER TABLE "inquiries"
  ADD COLUMN "is_dirt_road" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "quotations"
  ADD COLUMN "plan" VARCHAR(20) NOT NULL DEFAULT 'NORMAL';
