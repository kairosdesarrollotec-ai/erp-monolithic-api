-- Rollback C5: Restaurar permisos por defecto a RRHH (AUTHORIZE_LEAVE) y RRHH + ADMINISTRACION (SCHEDULE_VACATION).

UPDATE "role_permission_matrix_versions"
SET "allowed" = true
WHERE "action" = 'AUTHORIZE_LEAVE'
  AND "role_id" IN (
    SELECT "id" FROM "roles" WHERE "key" = 'RRHH'
  );

UPDATE "role_permission_matrix_versions"
SET "allowed" = true
WHERE "action" = 'SCHEDULE_VACATION'
  AND "role_id" IN (
    SELECT "id" FROM "roles" WHERE "key" IN ('RRHH', 'ADMINISTRACION')
  );
