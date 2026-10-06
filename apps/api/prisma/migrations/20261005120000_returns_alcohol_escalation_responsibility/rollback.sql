-- Rollback: 20261005120000_returns_alcohol_escalation_responsibility
-- Elimina el enum AlcoholEscalationDecision y revierte las columnas aditivas en "returns".
-- Estas columnas son todas NULL-able, por lo que no hay pérdida de datos NOT NULL.

-- Revertir columnas de responsabilidad (PROP-015)
ALTER TABLE "returns"
  DROP COLUMN IF EXISTS "responsibility_signed_at",
  DROP COLUMN IF EXISTS "responsibility_signature_data",
  DROP COLUMN IF EXISTS "responsibility_signer_relation",
  DROP COLUMN IF EXISTS "responsibility_signer_is_holder",
  DROP COLUMN IF EXISTS "responsibility_signer_name";

-- Revertir columnas de escalación de alcohol (PROP-014)
ALTER TABLE "returns"
  DROP COLUMN IF EXISTS "alcohol_escalation_decided_at",
  DROP COLUMN IF EXISTS "alcohol_escalation_decided_by_id",
  DROP COLUMN IF EXISTS "alcohol_escalation_notes",
  DROP COLUMN IF EXISTS "alcohol_escalation_marked_red",
  DROP COLUMN IF EXISTS "alcohol_escalation_decision";

-- Eliminar tipo ENUM (solo si ya no hay referencias)
DROP TYPE IF EXISTS "AlcoholEscalationDecision";
