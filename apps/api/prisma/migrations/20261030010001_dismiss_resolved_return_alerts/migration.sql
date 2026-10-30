-- V-23: descarta (no borra) las alertas de Gerencia de devoluciones ya resueltas o cerradas. Idempotente.
UPDATE "dashboard_items" d
SET "dismissed_at" = NOW()
FROM "returns" r
WHERE d."source_type" = 'RETURN'
  AND d."source_id" = r."id"::text
  AND d."dismissed_at" IS NULL
  AND (
    (d."source_event_id" LIKE 'return-alcohol-escalation:%'
      AND (r."status" = 'CERRADA' OR r."alcohol_escalation_decision" = 'CONTINUE_TO_INSPECTION'))
    OR (d."source_event_id" LIKE 'return-damage-cost-rejected:%' AND r."status" = 'CERRADA')
  );
