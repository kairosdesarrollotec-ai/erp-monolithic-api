-- Rollback para 20261023070001_field_trip_cascade_config_and_permissions
UPDATE "role_permission_matrix_versions"
SET "allowed" = false
WHERE "action" = 'AUTHORIZE_FIELD_TRIP'
  AND "role_id" IN (SELECT id FROM roles WHERE key = 'ADMINISTRACION');

ALTER TABLE "companies" DROP CONSTRAINT IF EXISTS "companies_field_trip_timeout_chk";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "field_trip_timeout_minutes";
