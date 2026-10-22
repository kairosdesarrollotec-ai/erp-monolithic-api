-- Rollback de 20261022010002_rental_cancellation (aplicar a mano). Se pierde el motivo/fecha/autor de las cancelaciones manuales.
ALTER TABLE "rentals"
  DROP COLUMN IF EXISTS "cancel_reason",
  DROP COLUMN IF EXISTS "cancel_note",
  DROP COLUMN IF EXISTS "cancelled_at",
  DROP COLUMN IF EXISTS "cancelled_by";
