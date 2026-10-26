-- Rollback de 20261023010001_reservation_customer_location (aplicar a mano; NO lo ejecuta Prisma).
ALTER TABLE "reservations"
  DROP COLUMN IF EXISTS "can_come_to_office",
  DROP COLUMN IF EXISTS "customer_location";

DROP TYPE IF EXISTS "CustomerLocation";
