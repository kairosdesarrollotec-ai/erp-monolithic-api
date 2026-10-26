-- C7: HU-31 Modelo documento + versiones con append-only, indice unico parcial para version vigente y confirmacion ligada a la version.

-- 1. Crear tabla de versiones de documentos
CREATE TABLE "hr_document_versions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "document_id" TEXT NOT NULL REFERENCES "hr_documents"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "file_url" TEXT NOT NULL,
  "file_hash" VARCHAR(128),
  "file_name" VARCHAR(255),
  "mime_type" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  "size_bytes" INTEGER,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "published_by" VARCHAR(128) NOT NULL,
  "published_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_hr_document_versions_doc_ver" UNIQUE ("document_id", "version")
);

-- Indice unico parcial: asegura que solo puede existir UNA version vigente (is_current = true) por documento
CREATE UNIQUE INDEX "idx_hr_doc_single_current"
  ON "hr_document_versions" ("document_id") WHERE "is_current" = true;

CREATE INDEX "idx_hr_doc_ver_doc_current"
  ON "hr_document_versions" ("document_id", "is_current");

-- 2. Migrar versiones existentes de hr_documents
INSERT INTO "hr_document_versions" (
  "id", "organization_id", "operating_company_id", "document_id",
  "version", "file_url", "file_hash", "file_name", "mime_type",
  "size_bytes", "is_current", "published_by", "published_at", "created_at"
)
SELECT
  d.id || '-v' || d.version,
  d.organization_id,
  d.operating_company_id,
  d.id,
  d.version,
  d.file_url,
  d.file_hash,
  d.file_name,
  d.mime_type,
  d.size_bytes,
  d.is_active,
  d.published_by,
  d.published_at,
  d.created_at
FROM "hr_documents" d;

-- 3. Migrar hr_document_reads hacia document_version_id
ALTER TABLE "hr_document_reads"
  ADD COLUMN "document_version_id" TEXT;

UPDATE "hr_document_reads" r
SET "document_version_id" = v.id
FROM "hr_document_versions" v
WHERE v.document_id = r.document_id;

UPDATE "hr_document_reads"
SET "document_version_id" = "document_id"
WHERE "document_version_id" IS NULL;

ALTER TABLE "hr_document_reads"
  DROP CONSTRAINT IF EXISTS "uq_hr_document_reads_doc_emp";

ALTER TABLE "hr_document_reads"
  DROP COLUMN "document_id";

ALTER TABLE "hr_document_reads"
  ALTER COLUMN "document_version_id" SET NOT NULL;

ALTER TABLE "hr_document_reads"
  ADD CONSTRAINT "hr_document_reads_document_version_id_fkey"
  FOREIGN KEY ("document_version_id") REFERENCES "hr_document_versions"("id") ON DELETE CASCADE;

ALTER TABLE "hr_document_reads"
  ADD CONSTRAINT "uq_hr_document_reads_ver_emp" UNIQUE ("document_version_id", "employee_id");

-- 4. Adaptar hr_documents como cabecera del documento
DROP INDEX IF EXISTS "hr_documents_company_code_unique_active";

ALTER TABLE "hr_documents"
  DROP COLUMN IF EXISTS "version",
  DROP COLUMN IF EXISTS "file_url",
  DROP COLUMN IF EXISTS "file_hash",
  DROP COLUMN IF EXISTS "file_name",
  DROP COLUMN IF EXISTS "mime_type",
  DROP COLUMN IF EXISTS "size_bytes",
  DROP COLUMN IF EXISTS "is_active",
  DROP COLUMN IF EXISTS "published_by",
  DROP COLUMN IF EXISTS "published_at";

CREATE UNIQUE INDEX "uq_hr_documents_company_code"
  ON "hr_documents" ("operating_company_id", "code");
