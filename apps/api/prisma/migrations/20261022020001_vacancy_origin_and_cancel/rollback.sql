-- Rollback de 20261022020001_vacancy_origin_and_cancel. Descarta el vinculo vacante<->terminacion y los datos de cancelacion
-- (la vacante cancelada conserva su estado CANCELADA; solo se pierde el motivo/fecha/autor).
DROP INDEX IF EXISTS "vacancies_origin_termination_idx";
DROP INDEX IF EXISTS "vacancies_origin_candidate_id_key";
DROP INDEX IF EXISTS "vacancies_origin_event_id_key";
ALTER TABLE "vacancies"
  DROP COLUMN IF EXISTS "cancelled_by",
  DROP COLUMN IF EXISTS "cancelled_at",
  DROP COLUMN IF EXISTS "cancel_reason",
  DROP COLUMN IF EXISTS "origin_candidate_id",
  DROP COLUMN IF EXISTS "origin_employee_id",
  DROP COLUMN IF EXISTS "origin_termination_id",
  DROP COLUMN IF EXISTS "origin_event_id";
