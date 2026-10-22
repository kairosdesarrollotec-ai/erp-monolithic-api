-- Rollback de 20261022010001_payment_proofs_reservation_and_deposit (aplicar a mano; NO lo ejecuta Prisma).
-- ADVERTENCIA: se pierden los comprobantes de pago registrados (medio, nº de operacion, pagador, referencia al comprobante).
ALTER TABLE "rental_deposits" DROP CONSTRAINT IF EXISTS "rental_deposits_payment_method_check";
ALTER TABLE "rental_deposits"
  DROP COLUMN IF EXISTS "payment_amount",
  DROP COLUMN IF EXISTS "payment_method",
  DROP COLUMN IF EXISTS "payment_operation_number",
  DROP COLUMN IF EXISTS "payer_name",
  DROP COLUMN IF EXISTS "payer_document_number",
  DROP COLUMN IF EXISTS "payer_is_external_agent",
  DROP COLUMN IF EXISTS "external_agent_verified_by",
  DROP COLUMN IF EXISTS "payment_voucher_document_id",
  DROP COLUMN IF EXISTS "payment_registered_by";
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_payment_method_check";
ALTER TABLE "reservations"
  DROP COLUMN IF EXISTS "payment_amount",
  DROP COLUMN IF EXISTS "payment_method",
  DROP COLUMN IF EXISTS "payment_operation_number",
  DROP COLUMN IF EXISTS "payer_name",
  DROP COLUMN IF EXISTS "payment_voucher_document_id",
  DROP COLUMN IF EXISTS "payment_registered_by";
