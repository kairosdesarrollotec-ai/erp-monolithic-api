-- Rollback: restaurar ON DELETE CASCADE (comportamiento original de la migración
-- 20261008000000_add_hr_administration_module, antes de aplicar RESTRICT).
-- ADVERTENCIA: revertir a CASCADE permite eliminar en cascada el registro de
-- terminación junto con el empleado — solo hacerlo en ambiente de desarrollo.

ALTER TABLE "employment_terminations"
  DROP CONSTRAINT IF EXISTS "employment_terminations_employee_id_fkey";

ALTER TABLE "employment_terminations"
  ADD CONSTRAINT "employment_terminations_employee_id_fkey"
  FOREIGN KEY ("employee_id")
  REFERENCES "employees"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
