-- TPL-TODO-002: eliminar la columna legacy template_version_id y la tabla contract_templates.
-- Prerrequisito completado (TPL-TODO-001):
--   rental_contracts.template_version_id ya es nullable (migración 20261009000001).
--   rental_contracts.template_id → templates(id) ya existe como FK activa.
-- Datos: se confirma que no hay contratos de producción que dependan de template_version_id.

-- 1. Eliminar la FK y la columna legacy
ALTER TABLE "rental_contracts" DROP COLUMN IF EXISTS "template_version_id";

-- 2. Eliminar el índice único parcial de la tabla legada
DROP INDEX IF EXISTS "contract_template_unique_active";

-- 3. Eliminar la tabla legada (no quedan filas referenciadas)
DROP TABLE IF EXISTS "contract_templates";

-- Reversión (no apta para producción si ya hay contratos nuevos con template_id):
-- CREATE TABLE "contract_templates" ( ... );  -- ver migración 20261001000000
-- ALTER TABLE "rental_contracts" ADD COLUMN "template_version_id" UUID REFERENCES "contract_templates"("id");
