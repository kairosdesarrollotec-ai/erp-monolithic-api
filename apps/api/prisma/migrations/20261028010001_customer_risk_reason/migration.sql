-- AlterTable: motivo del semaforo del cliente (H-17)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "status_reason" VARCHAR(500);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMP(3);
