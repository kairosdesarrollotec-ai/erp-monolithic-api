-- C4: Confirmacion de transferencia de reembolso por venta de vehiculo
ALTER TABLE "reservation_resolutions"
  ADD COLUMN "transfer_voucher" VARCHAR(120),
  ADD COLUMN "transferred_at" TIMESTAMP(3),
  ADD COLUMN "transferred_by" VARCHAR(120);
