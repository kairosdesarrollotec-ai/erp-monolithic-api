-- DEC-OPS-FORMATS-001 (23-oct-2026, R5)
-- Fichas operativas digitales por vehículo (Formatos 01-09) y recordatorios programados (FIVI interdiario y FITVM mensual).

CREATE TABLE "vehicle_operational_records" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "vehicle_id" TEXT NOT NULL,
  "format_type" VARCHAR(40) NOT NULL,
  "process_type" VARCHAR(40),
  "process_id" VARCHAR(100),
  "odometer_km" INTEGER,
  "fuel_level_lines" INTEGER,
  "data" JSONB NOT NULL DEFAULT '{}',
  "observations" TEXT,
  "performed_by" TEXT NOT NULL,
  "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "vehicle_operational_records"
  ADD CONSTRAINT "vehicle_operational_records_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_vehicle_operational_records_scope"
  ON "vehicle_operational_records" ("organization_id", "operating_company_id", "branch_id");

CREATE INDEX "idx_vehicle_operational_records_vehicle_format"
  ON "vehicle_operational_records" ("vehicle_id", "format_type", "performed_at");

CREATE TABLE "vehicle_format_reminders" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "vehicle_id" TEXT NOT NULL REFERENCES "vehicles"("id") ON DELETE CASCADE,
  "format_type" VARCHAR(40) NOT NULL,
  "due_date" TIMESTAMPTZ NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "completed_record_id" TEXT REFERENCES "vehicle_operational_records"("id") ON DELETE SET NULL,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chk_format_reminder_status" CHECK ("status" IN ('PENDING', 'COMPLETED', 'OVERDUE')),
  CONSTRAINT "uq_vehicle_format_reminders_period" UNIQUE ("vehicle_id", "format_type", "due_date")
);

CREATE INDEX "idx_vehicle_format_reminders_scope_status"
  ON "vehicle_format_reminders" ("operating_company_id", "status", "due_date");

-- Backfill permisos para registro y consulta de formatos operativos de flota
INSERT INTO "role_permission_matrix_versions" ("id", "organization_id", "version", "role_id", "company_id", "branch_id", "action", "allowed", "created_at")
SELECT
  gen_random_uuid(),
  m.organization_id,
  m.max_version,
  r.id,
  NULL,
  NULL,
  a.action,
  true,
  NOW()
FROM (
  SELECT organization_id, MAX(version) AS max_version
  FROM role_permission_matrix_versions
  WHERE company_id IS NULL AND branch_id IS NULL
  GROUP BY organization_id
) m
JOIN roles r ON r.organization_id = m.organization_id AND r.key IN ('OPERACIONES', 'MECANICO', 'ADMINISTRACION', 'GERENCIA')
CROSS JOIN (
  VALUES ('REGISTER_VEHICLE_OPERATIONAL_FORMAT'), ('VIEW_VEHICLE_OPERATIONAL_FORMAT')
) a(action)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permission_matrix_versions v
  WHERE v.organization_id = m.organization_id
    AND v.version = m.max_version
    AND v.role_id = r.id
    AND v.action = a.action
    AND v.company_id IS NULL
    AND v.branch_id IS NULL
);
