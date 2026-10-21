-- Rollback de 20261021010001_hr_areas_complete_catalog: quita las 2 areas agregadas SOLO si ningun empleado las usa.
DELETE FROM "hr_areas" a
WHERE a."code" IN ('GERENCIA_GENERAL', 'GESTION_Y_PROCESOS')
  AND NOT EXISTS (SELECT 1 FROM "employees" e WHERE e."operating_company_id" = a."operating_company_id" AND e."area_id" = a."code");
