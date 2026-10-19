-- BDD-REC-001 §11.6: flujo de estados Necesidad -> Publicado -> En negociación -> Entrevistado -> Decidido ->
-- Ingresado -> Periodo de prueba -> Planilla (+ Descartado / Terminado).
-- Escrita A MANO (nunca `migrate dev`), aditiva: un valor de enum, un tipo nuevo y 2 columnas con default/NULL.
--
-- ROLLBACK NOTE: ALTER TYPE ... ADD VALUE es irreversible en PostgreSQL (no existe DROP VALUE); mismo riesgo bajo
-- documentado que PAUSADA (20261012020000_recruitment_closure): ninguna fila usa el valor hasta que el código lo emita.
-- El valor ENTREVISTADA NO se usa en esta migración (PostgreSQL no permite usar un valor recién agregado en la misma
-- transacción); el backfill de vacantes vive en 20261019000300_recruitment_process_state_backfill.
-- Para revertir lo demás: ALTER TABLE "candidates" DROP COLUMN "process_state", DROP COLUMN "process_state_changed_at";
-- DROP TYPE "CandidateProcessState";

-- AlterEnum
ALTER TYPE "VacancyStatus" ADD VALUE IF NOT EXISTS 'ENTREVISTADA';

-- CreateEnum
CREATE TYPE "CandidateProcessState" AS ENUM ('EN_NEGOCIACION', 'ENTREVISTADO', 'DECIDIDO', 'DESCARTADO', 'INGRESADO', 'PERIODO_PRUEBA', 'PLANILLA', 'TERMINADO');

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "process_state" "CandidateProcessState" NOT NULL DEFAULT 'EN_NEGOCIACION',
ADD COLUMN     "process_state_changed_at" TIMESTAMP(3);

-- Backfill de candidatos (el tipo es nuevo, por lo que puede usarse en esta misma transacción).
-- Precedencia: la señal más avanzada gana. Un candidato registrado sin más datos queda EN_NEGOCIACION (default).
-- `process_state_changed_at` queda NULL en filas históricas (la fecha real del cambio no se conoce).
UPDATE "candidates" c SET "process_state" = CASE
    WHEN EXISTS (
      SELECT 1 FROM "employee_onboardings" o WHERE o."candidate_id" = c."id" AND o."probation_passed" IS TRUE
    ) THEN 'PLANILLA'::"CandidateProcessState"
    WHEN EXISTS (
      SELECT 1 FROM "employee_onboardings" o WHERE o."candidate_id" = c."id" AND o."probation_passed" IS FALSE
    ) THEN 'TERMINADO'::"CandidateProcessState"
    -- Incorporación completada = ingresó y su periodo de prueba arrancó (SDD UC-REC-004).
    WHEN EXISTS (
      SELECT 1 FROM "employee_onboardings" o WHERE o."candidate_id" = c."id" AND o."is_completed" IS TRUE
    ) THEN 'PERIODO_PRUEBA'::"CandidateProcessState"
    WHEN c."decision" = 'CONTRATADO' THEN 'DECIDIDO'::"CandidateProcessState"
    WHEN c."decision" = 'RECHAZADO' THEN 'DESCARTADO'::"CandidateProcessState"
    WHEN EXISTS (
      SELECT 1 FROM "candidate_interviews" i WHERE i."candidate_id" = c."id" AND i."result" <> 'PENDIENTE'
    ) THEN 'ENTREVISTADO'::"CandidateProcessState"
    ELSE 'EN_NEGOCIACION'::"CandidateProcessState"
  END;

-- Índice para listar/filtrar candidatos por estado de proceso dentro de una vacante.
CREATE INDEX "candidates_vacancy_id_process_state_idx" ON "candidates"("vacancy_id", "process_state");
