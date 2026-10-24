-- DEC-DEV-IMMOBILIZATION-001 / DEC-DEV-LEGAL-001 (23-oct-2026)
-- Agrega soporte de aceptacion de informe mecanico/Motrix para inmovilizacion y escalamiento a via legal en rental_returns.

ALTER TABLE "returns"
  ADD COLUMN "mechanic_report_accepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mechanic_report_accepted_at" TIMESTAMPTZ(6),
  ADD COLUMN "mechanic_report_accepted_by" TEXT,
  ADD COLUMN "mechanic_report_notes" VARCHAR(1000),
  ADD COLUMN "legal_escalated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "legal_escalated_at" TIMESTAMPTZ(6),
  ADD COLUMN "legal_escalated_by" TEXT,
  ADD COLUMN "legal_notes" VARCHAR(1000);
