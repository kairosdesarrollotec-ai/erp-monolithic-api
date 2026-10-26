-- DEC-AUTH-MATRIX-IMMUTABILITY-001 (R2b, R4b)
-- 1. Se crea una nueva versión de la matriz (version = max_version + 1) copiando la versión vigente de cada organización.
-- En esta nueva versión:
--   - AUTHORIZE_LEAVE y SCHEDULE_VACATION quedan con allowed = false para todo rol distinto de GERENCIA y PLATFORM_ADMIN.
--   - Historial de versiones anteriores queda intacto (inmutable).
--   - created_by = 'system_migration_20261023140001'.

INSERT INTO "role_permission_matrix_versions" (
  "id", "organization_id", "version", "role_id", "company_id", "branch_id", "action", "allowed", "created_at", "created_by"
)
SELECT
  gen_random_uuid(),
  v."organization_id",
  m.max_version + 1,
  v."role_id",
  v."company_id",
  v."branch_id",
  v."action",
  CASE
    WHEN v."action" IN ('AUTHORIZE_LEAVE', 'SCHEDULE_VACATION', 'HR_ADMINISTRATION.AUTHORIZE_LEAVE', 'HR_ADMINISTRATION.SCHEDULE_VACATION')
         AND r."key" NOT IN ('GERENCIA', 'PLATFORM_ADMIN')
    THEN false
    ELSE v."allowed"
  END,
  NOW(),
  'system_migration_20261023140001'
FROM role_permission_matrix_versions v
JOIN (
  SELECT organization_id, MAX(version) AS max_version
  FROM role_permission_matrix_versions
  GROUP BY organization_id
) m ON v.organization_id = m.organization_id AND v.version = m.max_version
JOIN roles r ON r.id = v.role_id AND r.organization_id = v.organization_id;

-- 2. R4b: Consistencia de permisos operativos de flota con las claves de rol reales (roles.key)
-- Se otorga REGISTER_VEHICLE_OPERATIONAL_FORMAT a GERENCIA, ADMINISTRACION, CAMPO y PLATFORM_ADMIN en la nueva versión.
INSERT INTO "role_permission_matrix_versions" (
  "id", "organization_id", "version", "role_id", "company_id", "branch_id", "action", "allowed", "created_at", "created_by"
)
SELECT
  gen_random_uuid(),
  m.organization_id,
  m.new_version,
  r.id,
  NULL,
  NULL,
  'REGISTER_VEHICLE_OPERATIONAL_FORMAT',
  true,
  NOW(),
  'system_migration_20261023140001'
FROM (
  SELECT organization_id, MAX(version) AS new_version
  FROM role_permission_matrix_versions
  WHERE created_by = 'system_migration_20261023140001'
  GROUP BY organization_id
) m
JOIN roles r ON r.organization_id = m.organization_id AND r.key IN ('GERENCIA', 'ADMINISTRACION', 'CAMPO', 'PLATFORM_ADMIN')
WHERE NOT EXISTS (
  SELECT 1 FROM role_permission_matrix_versions v
  WHERE v.organization_id = m.organization_id
    AND v.version = m.new_version
    AND v.role_id = r.id
    AND v.action IN ('REGISTER_VEHICLE_OPERATIONAL_FORMAT', 'FLEET.REGISTER_VEHICLE_OPERATIONAL_FORMAT')
    AND v.company_id IS NULL
    AND v.branch_id IS NULL
);

-- Se otorga VIEW_VEHICLE_OPERATIONAL_FORMAT a GERENCIA, ADMINISTRACION, CAMPO, FRONT_OFFICE, FINANZAS, AUDITORIA y PLATFORM_ADMIN.
INSERT INTO "role_permission_matrix_versions" (
  "id", "organization_id", "version", "role_id", "company_id", "branch_id", "action", "allowed", "created_at", "created_by"
)
SELECT
  gen_random_uuid(),
  m.organization_id,
  m.new_version,
  r.id,
  NULL,
  NULL,
  'VIEW_VEHICLE_OPERATIONAL_FORMAT',
  true,
  NOW(),
  'system_migration_20261023140001'
FROM (
  SELECT organization_id, MAX(version) AS new_version
  FROM role_permission_matrix_versions
  WHERE created_by = 'system_migration_20261023140001'
  GROUP BY organization_id
) m
JOIN roles r ON r.organization_id = m.organization_id AND r.key IN ('GERENCIA', 'ADMINISTRACION', 'CAMPO', 'FRONT_OFFICE', 'FINANZAS', 'AUDITORIA', 'PLATFORM_ADMIN')
WHERE NOT EXISTS (
  SELECT 1 FROM role_permission_matrix_versions v
  WHERE v.organization_id = m.organization_id
    AND v.version = m.new_version
    AND v.role_id = r.id
    AND v.action IN ('VIEW_VEHICLE_OPERATIONAL_FORMAT', 'FLEET.VIEW_VEHICLE_OPERATIONAL_FORMAT')
    AND v.company_id IS NULL
    AND v.branch_id IS NULL
);
