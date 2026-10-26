-- DEC-R1-FIX-001 (23-oct-2026, R1)
-- 1. Trocha: ningun vehiculo queda apto para trocha por defecto. Se revierte el true aplicado por 20261023020001.
-- El flag se configura exclusivamente desde Flota de forma manual al registrar/editar.
UPDATE "vehicles"
SET "suitable_for_trocha" = false
WHERE "suitable_for_trocha" = true;

-- 2. Tarifas por plan y multa de combustible: se eliminan los valores derivados del fallback 150
-- para cualquier modelo que no pertenezca a la tabla oficial de precios VR.01 (08/08/2026).
-- Solo se conservan los seeds oficiales: Q22 (Chery/Karry), Accent, Verna, Mahindra, Terios, Hilux, Spin, H1.
-- Cualquier otro vehiculo queda en NULL con aviso en Flota ("Falta tarifa del plan X").
UPDATE "vehicles"
SET "rate_normal" = NULL,
    "rate_plus" = NULL,
    "rate_libre" = NULL,
    "fuel_penalty_per_line" = NULL
WHERE NOT (
  "model" ILIKE '%Q22%' OR
  "model" ILIKE '%Accent%' OR
  "model" ILIKE '%Verna%' OR
  "model" ILIKE '%Mahindra%' OR
  "model" ILIKE '%Terios%' OR
  "model" ILIKE '%Hilux%' OR
  "model" ILIKE '%Spin%' OR
  "model" ILIKE '%H1%'
);
