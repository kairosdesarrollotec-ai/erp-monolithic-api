-- DEC-ALQ-CANCEL-001 (Russbel 22-oct-2026): cancelacion manual del alquiler antes de la entrega, con motivo obligatorio. Aditiva.
ALTER TABLE "rentals"
  ADD COLUMN "cancel_reason" VARCHAR(40),
  ADD COLUMN "cancel_note" VARCHAR(500),
  ADD COLUMN "cancelled_at" TIMESTAMPTZ(6),
  ADD COLUMN "cancelled_by" TEXT;
