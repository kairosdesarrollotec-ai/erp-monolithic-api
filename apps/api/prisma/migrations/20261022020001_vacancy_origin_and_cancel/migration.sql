-- 22-oct-2026 (Respuestas Russbel #5): la terminacion laboral crea AUTOMATICAMENTE la vacante en Reclutamiento (idempotente por el
-- evento que la origino) y la vacante puede CANCELARSE con motivo obligatorio (REC-02). Escrita A MANO (nunca `migrate dev`), ADITIVA:
-- solo columnas nullable + un indice unico + un indice de consulta. Los datos existentes no cambian.
--  - origin_event_id: id del evento outbox (RelacionLaboralTerminada.v1) que creo la vacante; UNIQUE => un evento, una vacante.
--  - origin_termination_id / origin_employee_id / origin_candidate_id (UNIQUE): de donde viene (null en vacantes registradas a mano).
--  - cancel_reason / cancelled_at / cancelled_by: auditoria de la cancelacion (la fila no se borra; los candidatos siguen consultables).
ALTER TABLE "vacancies"
  ADD COLUMN "origin_event_id" TEXT,
  ADD COLUMN "origin_termination_id" TEXT,
  ADD COLUMN "origin_employee_id" TEXT,
  ADD COLUMN "origin_candidate_id" TEXT,
  ADD COLUMN "cancel_reason" VARCHAR(500),
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_by" TEXT;

CREATE UNIQUE INDEX "vacancies_origin_event_id_key" ON "vacancies"("origin_event_id");
-- Un candidato solo puede originar UNA vacante de reemplazo: la prueba negativa (Reclutamiento) y la baja de la ficha (Personal) pueden
-- referirse a la misma salida y no deben duplicarla.
CREATE UNIQUE INDEX "vacancies_origin_candidate_id_key" ON "vacancies"("origin_candidate_id");
CREATE INDEX "vacancies_origin_termination_idx" ON "vacancies"("origin_termination_id");
