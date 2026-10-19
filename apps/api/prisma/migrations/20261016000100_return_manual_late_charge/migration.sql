-- DEC-DEV-LATE-CHARGE-002 (Fiorella, 2026-10-16): cargo por retraso en la devolucion, MANUAL por ahora.
-- Escrita A MANO (nunca `migrate dev`), aditiva y sin bloqueos largos: 4 columnas NULL sin default.
ALTER TABLE "returns" ADD COLUMN "late_charge_amount" DECIMAL(12,2);
ALTER TABLE "returns" ADD COLUMN "late_charge_notes" TEXT;
ALTER TABLE "returns" ADD COLUMN "late_charge_registered_by_id" TEXT;
ALTER TABLE "returns" ADD COLUMN "late_charge_registered_at" TIMESTAMP(3);
