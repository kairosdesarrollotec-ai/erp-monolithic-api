-- DEC-RES-PAYPROOF-001 / DEC-ALQ-PAYPROOF-001 (Russbel 22-oct-2026, decision 8): medios de pago y comprobante de la reserva
-- y de la garantia del alquiler. Aditiva: todas las columnas son NULL en filas existentes.
ALTER TABLE "reservations"
  ADD COLUMN "payment_amount" DECIMAL(12,2),
  ADD COLUMN "payment_method" VARCHAR(20),
  ADD COLUMN "payment_operation_number" VARCHAR(60),
  ADD COLUMN "payer_name" VARCHAR(120),
  ADD COLUMN "payment_voucher_document_id" UUID,
  ADD COLUMN "payment_registered_by" TEXT;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_payment_method_check"
  CHECK ("payment_method" IS NULL OR "payment_method" IN ('TRANSFERENCIA','DEPOSITO','PLIN','YAPE','EFECTIVO','POS'));

ALTER TABLE "rental_deposits"
  ADD COLUMN "payment_amount" DECIMAL(12,2),
  ADD COLUMN "payment_method" VARCHAR(20),
  ADD COLUMN "payment_operation_number" VARCHAR(60),
  ADD COLUMN "payer_name" VARCHAR(120),
  ADD COLUMN "payer_document_number" VARCHAR(30),
  ADD COLUMN "payer_is_external_agent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "external_agent_verified_by" TEXT,
  ADD COLUMN "payment_voucher_document_id" UUID,
  ADD COLUMN "payment_registered_by" TEXT;

ALTER TABLE "rental_deposits"
  ADD CONSTRAINT "rental_deposits_payment_method_check"
  CHECK ("payment_method" IS NULL OR "payment_method" IN ('TRANSFERENCIA','DEPOSITO','PLIN','YAPE','EFECTIVO','POS'));
