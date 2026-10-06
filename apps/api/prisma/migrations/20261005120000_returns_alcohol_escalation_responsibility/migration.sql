-- PROP-014 (PROVISIONAL): decision de Gerencia ante alcolimetro desfavorable
-- PROP-015 (PROVISIONAL): documento de responsabilidad firmado en la inspeccion (BR-DEV-009, DAT-DEV-005, EX-DEV-001)
-- Cambios 100% aditivos sobre "returns" (columnas NULL) + un enum nuevo.

-- CreateEnum
CREATE TYPE "AlcoholEscalationDecision" AS ENUM ('CONTINUE_TO_INSPECTION', 'KEEP_IN_CUSTODY');

-- AlterTable
ALTER TABLE "returns"
  ADD COLUMN "alcohol_escalation_decision" "AlcoholEscalationDecision",
  ADD COLUMN "alcohol_escalation_marked_red" BOOLEAN,
  ADD COLUMN "alcohol_escalation_notes" TEXT,
  ADD COLUMN "alcohol_escalation_decided_by_id" TEXT,
  ADD COLUMN "alcohol_escalation_decided_at" TIMESTAMP(3),
  ADD COLUMN "responsibility_signer_name" TEXT,
  ADD COLUMN "responsibility_signer_is_holder" BOOLEAN,
  ADD COLUMN "responsibility_signer_relation" TEXT,
  ADD COLUMN "responsibility_signature_data" TEXT,
  ADD COLUMN "responsibility_signed_at" TIMESTAMP(3);
