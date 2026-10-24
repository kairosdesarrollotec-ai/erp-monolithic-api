-- DEC-HR-DOCS-SENSITIVE-001 (23-oct-2026, R6)
-- HU-31: Repositorio versionado de documentos de Talento Humano (reglamentos, politicas y formatos) con una unica version vigente y registro de lectura.
-- HU-35: Datos personales sensibles del colaborador (DNI, sueldo base, contrato y cuenta bancaria) protegidos por permiso especifico.

-- 1. Campos de cuenta bancaria y contrato en employees
ALTER TABLE "employees"
  ADD COLUMN "bank_name" VARCHAR(100),
  ADD COLUMN "bank_account_number" VARCHAR(50),
  ADD COLUMN "bank_account_cci" VARCHAR(50),
  ADD COLUMN "contract_type" VARCHAR(50),
  ADD COLUMN "contract_url" VARCHAR(500),
  ADD COLUMN "contract_notes" TEXT;

-- 2. Tabla de documentos de Talento Humano (versionado append-only, una sola version activa por empresa + codigo)
CREATE TABLE "hr_documents" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "code" VARCHAR(50) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "category" VARCHAR(50) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "file_url" TEXT NOT NULL,
  "file_hash" VARCHAR(128),
  "file_name" VARCHAR(255),
  "mime_type" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  "size_bytes" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "published_by" VARCHAR(128) NOT NULL,
  "published_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chk_hr_document_category" CHECK ("category" IN ('REGULATION', 'POLICY', 'FORMAT'))
);

CREATE UNIQUE INDEX "hr_documents_company_code_unique_active"
  ON "hr_documents" ("operating_company_id", "code") WHERE "is_active" = true;

CREATE INDEX "idx_hr_documents_scope_category"
  ON "hr_documents" ("operating_company_id", "category", "created_at");

-- 3. Tabla de confirmacion de lectura de documentos de Talento Humano
CREATE TABLE "hr_document_reads" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "document_id" TEXT NOT NULL REFERENCES "hr_documents"("id") ON DELETE CASCADE,
  "employee_id" TEXT NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "read_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "read_by_uid" VARCHAR(128) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_hr_document_reads_doc_emp" UNIQUE ("document_id", "employee_id")
);

CREATE INDEX "idx_hr_document_reads_employee"
  ON "hr_document_reads" ("employee_id");

-- 4. Backfill permisos en matriz dinamica editable (ADM-02)
-- VIEW_EMPLOYEE_SENSITIVE_DATA y MANAGE_HR_DOCUMENTS -> GERENCIA
-- VIEW_HR_DOCUMENTS y CONFIRM_HR_DOCUMENT_READ -> GERENCIA, RRHH, ADMINISTRACION, FINANZAS, AUDITORIA, CAMPO, FRONT_OFFICE, MECANICO
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
JOIN roles r ON r.organization_id = m.organization_id AND r.key = 'GERENCIA'
CROSS JOIN (
  VALUES ('VIEW_EMPLOYEE_SENSITIVE_DATA'), ('MANAGE_HR_DOCUMENTS')
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
JOIN roles r ON r.organization_id = m.organization_id AND r.key IN ('GERENCIA', 'RRHH', 'ADMINISTRACION', 'FINANZAS', 'AUDITORIA', 'CAMPO', 'FRONT_OFFICE', 'MECANICO')
CROSS JOIN (
  VALUES ('VIEW_HR_DOCUMENTS'), ('CONFIRM_HR_DOCUMENT_READ')
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
