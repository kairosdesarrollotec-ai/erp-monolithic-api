-- DEC-AUTH-MATRIX-IMMUTABILITY-001 Rollback
-- Elimina únicamente las filas creadas para la nueva versión de la matriz,
-- restaurando la versión anterior como vigente sin tocar su historial.
DELETE FROM "role_permission_matrix_versions"
WHERE "created_by" = 'system_migration_20261023140001';
