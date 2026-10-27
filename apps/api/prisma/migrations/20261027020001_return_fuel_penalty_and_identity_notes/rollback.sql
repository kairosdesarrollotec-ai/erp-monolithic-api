-- Rollback
ALTER TABLE "returns" DROP COLUMN IF EXISTS "return_identity_notes";
ALTER TABLE "returns" DROP COLUMN IF EXISTS "fuel_penalty_amount";
ALTER TABLE "returns" DROP COLUMN IF EXISTS "fuel_penalty_notes";
ALTER TABLE "returns" DROP COLUMN IF EXISTS "fuel_penalty_registered_by_id";
ALTER TABLE "returns" DROP COLUMN IF EXISTS "fuel_penalty_registered_at";
