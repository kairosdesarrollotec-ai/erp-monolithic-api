ALTER TABLE "returns"
  DROP COLUMN IF EXISTS "mechanic_report_accepted",
  DROP COLUMN IF EXISTS "mechanic_report_accepted_at",
  DROP COLUMN IF EXISTS "mechanic_report_accepted_by",
  DROP COLUMN IF EXISTS "mechanic_report_notes",
  DROP COLUMN IF EXISTS "legal_escalated",
  DROP COLUMN IF EXISTS "legal_escalated_at",
  DROP COLUMN IF EXISTS "legal_escalated_by",
  DROP COLUMN IF EXISTS "legal_notes";
