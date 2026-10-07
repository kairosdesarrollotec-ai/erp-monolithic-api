-- ROLES DINAMICOS Y AUTORIZACION POR PERMISOS (fase 2, back).
-- Diseno: claude/Diseno_Roles_Dinamicos_y_Permisos.md (Project KAIROS);
-- contrato: packages/contracts/openapi/admin.yaml 0.2.0.
--
-- El rol deja de ser el enum "WorkerRole" y pasa a ser un DATO de la
-- organizacion (tabla "roles"). Migracion segura por pasos, todo en la
-- misma transaccion (si cualquier guarda falla se revierte completa):
--   1. crear "roles" (+ indices, incluido el unico funcional por nombre);
--   2. sembrar los 8 roles de sistema por cada organizacion existente;
--   3. user_company_assignments: agregar role_id nullable, backfill desde
--      la columna enum "role", luego NOT NULL + FK compuesta;
--      la columna enum "role" queda DEPRECADA (nullable, nadie la lee ni la
--      escribe; se retira en un PR posterior - contract del expand/contract);
--   4. role_permission_matrix_versions: role_id + ambito (company_id /
--      branch_id) por version; las versiones ya guardadas se remapean
--      enum -> role_id por organizacion; "role" tambien queda deprecada.
--
-- "organizacion" no es una tabla: es el organization_id que comparten
-- companies, asignaciones, perfiles y versiones de matriz. Se siembran roles
-- para la UNION de todos los que aparecen en esas tablas.
--
-- Indices/constraints: nombres explicitos <= 63 caracteres que coinciden
-- con los `map:` de schema.prisma (el gate "migrate diff --exit-code" del CI
-- detecta cualquier divergencia). El indice unico funcional
-- "roles_organization_id_lower_name_key" (organization_id, lower(name)) solo
-- existe en SQL: Prisma no modela indices de expresion y los ignora en el
-- diff (mismo caso que contract_template_unique_active).

-- 1. CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
    -- ROLE_NAME_INVALID tambien a nivel de base: sin espacios sobrantes, 1..60 caracteres.
    CONSTRAINT "roles_name_length_check" CHECK (char_length("name") BETWEEN 1 AND 60 AND "name" = btrim("name")),
    CONSTRAINT "roles_version_positive_check" CHECK ("version" >= 1)
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_id_organization_id_key" ON "roles"("id", "organization_id");
CREATE UNIQUE INDEX "roles_organization_id_key_key" ON "roles"("organization_id", "key");
CREATE INDEX "roles_organization_id_active_idx" ON "roles"("organization_id", "active");

-- Nombre unico por organizacion SIN distinguir mayusculas (ROLE_NAME_TAKEN).
-- Solo SQL (indice de expresion).
CREATE UNIQUE INDEX "roles_organization_id_lower_name_key" ON "roles"("organization_id", lower("name"));

-- 2. Roles de sistema por organizacion existente. key = valor del enum
-- WorkerRole; name = la etiqueta legible vigente (WORKER_ROLE_LABELS del front).
INSERT INTO "roles" ("id", "organization_id", "key", "name", "is_system", "active", "version", "created_at", "updated_at")
SELECT gen_random_uuid()::text, orgs."organization_id", sys."key", sys."name", true, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT "organization_id" FROM "companies"
    UNION SELECT "organization_id" FROM "user_company_assignments"
    UNION SELECT "organization_id" FROM "role_permission_matrix_versions"
    UNION SELECT "organization_id" FROM "user_profiles"
) AS orgs
CROSS JOIN (VALUES
    ('ADMINISTRACION', 'Administración'),
    ('AUDITORIA', 'Auditoría'),
    ('CAMPO', 'Campo'),
    ('FINANZAS', 'Finanzas'),
    ('FRONT_OFFICE', 'Front Office'),
    ('GERENCIA', 'Gerencia'),
    ('PLATFORM_ADMIN', 'Administrador de Plataforma'),
    ('RRHH', 'RR. HH.')
) AS sys("key", "name");

-- 3. user_company_assignments: role_id (expand -> backfill -> contract)
ALTER TABLE "user_company_assignments" ADD COLUMN "role_id" TEXT;

UPDATE "user_company_assignments" AS a
SET "role_id" = r."id"
FROM "roles" AS r
WHERE r."organization_id" = a."organization_id"
  AND r."key" = a."role"::text;

DO $$
DECLARE
    pending integer;
BEGIN
    SELECT count(*) INTO pending FROM "user_company_assignments" WHERE "role_id" IS NULL;
    IF pending > 0 THEN
        RAISE EXCEPTION 'dynamic_roles: % asignacion(es) sin rol_id tras el backfill desde el enum role; se aborta sin cambios', pending;
    END IF;
END
$$;

ALTER TABLE "user_company_assignments" ALTER COLUMN "role_id" SET NOT NULL;
-- La columna enum queda DEPRECADA: nullable, sin lecturas ni escrituras nuevas.
ALTER TABLE "user_company_assignments" ALTER COLUMN "role" DROP NOT NULL;

-- FK compuesta: el rol de la asignacion debe ser de la MISMA organizacion.
ALTER TABLE "user_company_assignments" ADD CONSTRAINT "user_company_assignments_role_id_organization_id_fkey" FOREIGN KEY ("role_id", "organization_id") REFERENCES "roles"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex (assignmentCount y "rol con asignaciones activas")
CREATE INDEX "user_company_assignments_role_id_active_idx" ON "user_company_assignments"("role_id", "active");

-- 4. role_permission_matrix_versions: role_id + ambito por version
ALTER TABLE "role_permission_matrix_versions"
    ADD COLUMN "role_id" TEXT,
    ADD COLUMN "company_id" TEXT,
    ADD COLUMN "branch_id" TEXT;

UPDATE "role_permission_matrix_versions" AS m
SET "role_id" = r."id"
FROM "roles" AS r
WHERE r."organization_id" = m."organization_id"
  AND r."key" = m."role"::text;

DO $$
DECLARE
    pending integer;
BEGIN
    SELECT count(*) INTO pending FROM "role_permission_matrix_versions" WHERE "role_id" IS NULL;
    IF pending > 0 THEN
        RAISE EXCEPTION 'dynamic_roles: % celda(s) de matriz sin role_id tras el backfill desde el enum role; se aborta sin cambios', pending;
    END IF;
END
$$;

ALTER TABLE "role_permission_matrix_versions" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "role_permission_matrix_versions" ALTER COLUMN "role" DROP NOT NULL;

-- La clave unica pasa de (org, version, role, action) a (org, version, role_id, action).
DROP INDEX "role_permission_matrix_versions_organization_id_version_rol_key";
CREATE UNIQUE INDEX "role_permission_matrix_org_version_role_id_action_key" ON "role_permission_matrix_versions"("organization_id", "version", "role_id", "action");

-- Resolucion del ambito vigente: ultima version por (org, empresa, sede).
CREATE INDEX "role_permission_matrix_versions_scope_version_idx" ON "role_permission_matrix_versions"("organization_id", "company_id", "branch_id", "version");

-- Integridad multi-organizacion: rol y ambito deben ser de la MISMA organizacion.
ALTER TABLE "role_permission_matrix_versions" ADD CONSTRAINT "role_permission_matrix_versions_role_id_organization_id_fkey" FOREIGN KEY ("role_id", "organization_id") REFERENCES "roles"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permission_matrix_versions" ADD CONSTRAINT "role_permission_matrix_versions_company_id_organization_id_fkey" FOREIGN KEY ("company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permission_matrix_versions" ADD CONSTRAINT "role_permission_matrix_versions_branch_id_company_id_fkey" FOREIGN KEY ("branch_id", "company_id") REFERENCES "branches"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una sede sin empresa no tiene sentido (la FK compuesta no valida con NULL en MATCH SIMPLE).
ALTER TABLE "role_permission_matrix_versions" ADD CONSTRAINT "role_permission_matrix_versions_scope_check" CHECK ("branch_id" IS NULL OR "company_id" IS NOT NULL);
