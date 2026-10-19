-- BDD-REC-001 §11.6: backfill del estado de las VACANTES con el estado de proceso de sus candidatos.
-- Va en una migración aparte porque usa el valor 'ENTREVISTADA' agregado en 20261019000200_recruitment_process_state
-- (PostgreSQL no permite usar un valor de enum en la misma transacción que lo crea).
-- Solo avanza vacantes activas (PUBLICADA / EN_NEGOCIACION); NECESIDAD_REGISTRADA, PAUSADA, CANCELADA y DECIDIDA no se tocan.
-- El estado de la vacante es monótono: nunca retrocede, y un candidato descartado no la hace retroceder (EX-REC-001).
-- No incrementa `version` (no es una edición del usuario).
UPDATE "vacancies" v SET "status" = CASE
    WHEN EXISTS (
      SELECT 1 FROM "candidates" c WHERE c."vacancy_id" = v."id" AND c."decision" = 'CONTRATADO'
    ) THEN 'DECIDIDA'::"VacancyStatus"
    WHEN EXISTS (
      SELECT 1 FROM "candidates" c WHERE c."vacancy_id" = v."id" AND c."process_state" = 'ENTREVISTADO'
    ) THEN 'ENTREVISTADA'::"VacancyStatus"
    ELSE 'EN_NEGOCIACION'::"VacancyStatus"
  END
WHERE v."status" IN ('PUBLICADA', 'EN_NEGOCIACION')
  AND EXISTS (SELECT 1 FROM "candidates" c WHERE c."vacancy_id" = v."id");
