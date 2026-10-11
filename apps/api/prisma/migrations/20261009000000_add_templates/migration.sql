-- TDD-KAIROS-MVP-002-TPL §4.1 + §8
-- Módulo: templates (plantillas de documentos base)
-- Commit de referencia: 96beb9f (tdd-templates.md v1.0)
-- Reversión: DROP INDEX templates_unique_active; DROP INDEX templates_company_type_idx; DROP INDEX templates_organization_idx; DROP TABLE templates;

-- Nueva tabla `templates`
CREATE TABLE "templates" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT         NOT NULL,
    "company_id"      TEXT         NOT NULL,
    "type"            VARCHAR(50)  NOT NULL,
    "name"            VARCHAR(200) NOT NULL,
    "version"         INTEGER,
    "status"          TEXT         NOT NULL DEFAULT 'DRAFT',
    "document_url"    TEXT,
    "document_format" TEXT,
    "effective_from"  TIMESTAMPTZ,
    "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "created_by"      TEXT         NOT NULL,
    "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_by"      TEXT         NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "templates_company_id_organization_id_fkey"
        FOREIGN KEY ("company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Índice parcial único: una sola plantilla ACTIVE por (company_id, type) — TDD-TPL-ADR-003
CREATE UNIQUE INDEX "templates_unique_active"
    ON "templates" ("company_id", "type")
    WHERE (status = 'ACTIVE');

-- Índices de consulta
CREATE INDEX "templates_company_type_idx"
    ON "templates" ("company_id", "type");

CREATE INDEX "templates_organization_idx"
    ON "templates" ("organization_id");
