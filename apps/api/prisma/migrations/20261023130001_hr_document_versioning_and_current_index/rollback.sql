-- Rollback C7: Revertir modelo de versiones a tabla plana hr_documents

ALTER TABLE "hr_documents"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "file_url" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "file_hash" VARCHAR(128),
  ADD COLUMN "file_name" VARCHAR(255),
  ADD COLUMN "mime_type" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  ADD COLUMN "size_bytes" INTEGER,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "published_by" VARCHAR(128) NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "published_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE "hr_documents" d
SET
  "version" = v.version,
  "file_url" = v.file_url,
  "file_hash" = v.file_hash,
  "file_name" = v.file_name,
  "mime_type" = v.mime_type,
  "size_bytes" = v.size_bytes,
  "is_active" = v.is_current,
  "published_by" = v.published_by,
  "published_at" = v.published_at
FROM "hr_document_versions" v
WHERE v.document_id = d.id AND v.is_current = true;

DROP INDEX IF EXISTS "uq_hr_documents_company_code";

CREATE UNIQUE INDEX "hr_documents_company_code_unique_active"
  ON "hr_documents" ("operating_company_id", "code") WHERE "is_active" = true;

ALTER TABLE "hr_document_reads"
  ADD COLUMN "document_id" TEXT;

UPDATE "hr_document_reads" r
SET "document_id" = v.document_id
FROM "hr_document_versions" v
WHERE v.id = r.document_version_id;

ALTER TABLE "hr_document_reads"
  DROP CONSTRAINT IF EXISTS "uq_hr_document_reads_ver_emp";

ALTER TABLE "hr_document_reads"
  DROP COLUMN "document_version_id";

ALTER TABLE "hr_document_reads"
  ALTER COLUMN "document_id" SET NOT NULL;

ALTER TABLE "hr_document_reads"
  ADD CONSTRAINT "hr_document_reads_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "hr_documents"("id") ON DELETE CASCADE;

ALTER TABLE "hr_document_reads"
  ADD CONSTRAINT "uq_hr_document_reads_doc_emp" UNIQUE ("document_id", "employee_id");

DROP TABLE IF EXISTS "hr_document_versions";
