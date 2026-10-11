-- TPL-TODO-001: añade template_id a rental_contracts → templates.id
-- Permite que los nuevos contratos de alquiler referencien la nueva tabla templates
-- en lugar de la tabla legacy contract_templates.
--
-- Reversión:
--   ALTER TABLE "rental_contracts" DROP COLUMN "template_id";
--   ALTER TABLE "rental_contracts" ALTER COLUMN "template_version_id" SET NOT NULL;

-- Nueva FK nullable hacia la nueva tabla templates
ALTER TABLE "rental_contracts"
  ADD COLUMN "template_id" UUID
  REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- template_version_id pasa a nullable (los nuevos contratos usarán template_id)
ALTER TABLE "rental_contracts"
  ALTER COLUMN "template_version_id" DROP NOT NULL;
