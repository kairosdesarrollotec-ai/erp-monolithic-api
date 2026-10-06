-- PROP-015b: Módulo de plantillas de documentos (BR-DEV-009)
-- Plantilla estándar para el documento de responsabilidad del proceso de devolución.
-- La columna updated_at es gestionada por Prisma (@updatedAt), no por trigger.

CREATE TABLE "document_templates" (
  "id"          TEXT         NOT NULL,
  "company_id"  TEXT         NOT NULL,
  "type"        VARCHAR(50)  NOT NULL,
  "name"        VARCHAR(200) NOT NULL,
  "content"     TEXT         NOT NULL,
  "version"     INTEGER      NOT NULL,
  "is_active"   BOOLEAN      NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_templates_company_id_type_version_key"
    UNIQUE ("company_id", "type", "version"),
  CONSTRAINT "document_templates_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "document_templates_company_id_type_is_active_idx"
  ON "document_templates" ("company_id", "type", "is_active");
