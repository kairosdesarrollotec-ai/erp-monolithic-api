-- F-05 / G-05 (Fiorella, 2026-10-16): capacidad de pasajeros y precio de combustible se registran en Flota.
-- Escrita A MANO (nunca `migrate dev`), aditiva: 2 columnas NULL sin default; los vehiculos existentes quedan en NULL.
ALTER TABLE "vehicles" ADD COLUMN "passenger_capacity" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN "fuel_price" DECIMAL(10,2);
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_passenger_capacity_range_chk" CHECK ("passenger_capacity" IS NULL OR "passenger_capacity" BETWEEN 1 AND 60);
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_fuel_price_nonneg_chk" CHECK ("fuel_price" IS NULL OR "fuel_price" >= 0);
