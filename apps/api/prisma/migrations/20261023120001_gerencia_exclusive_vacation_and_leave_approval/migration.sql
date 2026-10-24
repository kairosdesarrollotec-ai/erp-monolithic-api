-- C5: Solo Gerencia aprueba o deniega permisos (AUTHORIZE_LEAVE) y concede vacaciones (SCHEDULE_VACATION).
-- Se retira el permiso por defecto a roles distintos de GERENCIA y PLATFORM_ADMIN en role_permission_matrix_versions.

UPDATE "role_permission_matrix_versions"
SET "allowed" = false
WHERE "action" IN ('AUTHORIZE_LEAVE', 'SCHEDULE_VACATION')
  AND "role_id" NOT IN (
    SELECT "id" FROM "roles" WHERE "key" IN ('GERENCIA', 'PLATFORM_ADMIN')
  );
