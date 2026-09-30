-- Hallazgo MEDIO PR#34 (Finding #8): la FK compuesta (branch_id, operating_company_id)
-- usaba ON DELETE SET NULL, pero operating_company_id es NOT NULL.
-- Al borrar una sede, PostgreSQL intentaria poner NULL en ambas columnas y fallaria.
-- Correccion: ON DELETE RESTRICT impide borrar una sede que tenga vehiculos asignados.

ALTER TABLE "vehicles" DROP CONSTRAINT IF EXISTS "vehicles_branch_id_operating_company_id_fkey";

ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_branch_id_operating_company_id_fkey"
  FOREIGN KEY ("branch_id", "operating_company_id")
  REFERENCES "branches"("id", "company_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
