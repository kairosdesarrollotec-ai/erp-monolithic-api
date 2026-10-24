-- DEC-ADP-FIELD-TRIP-001 (23-oct-2026, R3)
-- 1. Parametro configurable por tenant (empresa) para el tiempo de respuesta por nivel en cascada de salidas a campo.
-- Rango permitido: 3 a 10 minutos (valor por defecto / vigente: 5 minutos).
ALTER TABLE "companies"
  ADD COLUMN "field_trip_timeout_minutes" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_field_trip_timeout_chk" CHECK ("field_trip_timeout_minutes" BETWEEN 3 AND 10);

-- 2. Backfill de permisos: el rol ADMINISTRACION (Cecilia) debe poder autorizar el nivel 3 de la cascada de salidas a campo.
-- Se otorga AUTHORIZE_FIELD_TRIP a ADMINISTRACION por defecto en la matriz de roles y permisos dinamicos versionada.
INSERT INTO "role_permission_matrix_versions" ("id", "organization_id", "version", "role_id", "company_id", "branch_id", "action", "allowed", "created_at")
SELECT
  gen_random_uuid(),
  m.organization_id,
  m.max_version,
  r.id,
  NULL,
  NULL,
  'AUTHORIZE_FIELD_TRIP',
  true,
  NOW()
FROM (
  SELECT organization_id, MAX(version) AS max_version
  FROM role_permission_matrix_versions
  WHERE company_id IS NULL AND branch_id IS NULL
  GROUP BY organization_id
) m
JOIN roles r ON r.organization_id = m.organization_id AND r.key = 'ADMINISTRACION'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permission_matrix_versions v
  WHERE v.organization_id = m.organization_id
    AND v.version = m.max_version
    AND v.role_id = r.id
    AND v.action = 'AUTHORIZE_FIELD_TRIP'
    AND v.company_id IS NULL
    AND v.branch_id IS NULL
);

UPDATE "role_permission_matrix_versions"
SET "allowed" = true
WHERE "action" = 'AUTHORIZE_FIELD_TRIP'
  AND "role_id" IN (SELECT id FROM roles WHERE key = 'ADMINISTRACION');
