-- AlterTable
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "return_identity_notes" VARCHAR(1000);
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "fuel_penalty_amount" DECIMAL(12,2);
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "fuel_penalty_notes" TEXT;
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "fuel_penalty_registered_by_id" TEXT;
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "fuel_penalty_registered_at" TIMESTAMP(3);
