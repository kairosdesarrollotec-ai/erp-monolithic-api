-- ADP-DEBT-005: cambiar ON DELETE CASCADE → RESTRICT en employment_terminations.
--
-- Fundamento: EmploymentTermination es un registro permanente de auditoría y el
-- disparador del evento RelacionLaboralTerminada (ADR-KAI-006). Permitir que se
-- elimine en cascada al borrar un Employee destruiría el historial irreversiblemente.
-- RESTRICT impide borrar un Employee que ya tenga registro de terminación,
-- que es el comportamiento correcto para producción: TERMINADO es estado terminal.

ALTER TABLE "employment_terminations"
  DROP CONSTRAINT "employment_terminations_employee_id_fkey";

ALTER TABLE "employment_terminations"
  ADD CONSTRAINT "employment_terminations_employee_id_fkey"
  FOREIGN KEY ("employee_id")
  REFERENCES "employees"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
