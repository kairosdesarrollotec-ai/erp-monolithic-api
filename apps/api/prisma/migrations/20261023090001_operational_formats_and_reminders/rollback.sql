-- Rollback DEC-OPS-FORMATS-001 (23-oct-2026, R5)

DELETE FROM "role_permission_matrix_versions"
WHERE "action" IN ('REGISTER_VEHICLE_OPERATIONAL_FORMAT', 'VIEW_VEHICLE_OPERATIONAL_FORMAT');

DROP TABLE IF EXISTS "vehicle_format_reminders";
DROP TABLE IF EXISTS "vehicle_operational_records";
