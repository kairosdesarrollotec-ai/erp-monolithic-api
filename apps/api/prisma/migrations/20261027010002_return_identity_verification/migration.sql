-- HU-03: Verificación de identidad en entrega/recepción de vehículo
ALTER TABLE "returns"
  ADD COLUMN IF NOT EXISTS "return_identity_verified" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "return_identity_document_type" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "return_identity_document_number" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "return_identity_matches_holder" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "return_identity_result" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "return_identity_verified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "return_identity_verified_by" VARCHAR(128);
