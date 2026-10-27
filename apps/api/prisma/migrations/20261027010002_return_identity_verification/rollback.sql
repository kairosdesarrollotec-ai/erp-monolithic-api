-- Rollback HU-03: Verificación de identidad en entrega/recepción
ALTER TABLE "returns"
  DROP COLUMN IF EXISTS "return_identity_verified",
  DROP COLUMN IF EXISTS "return_identity_document_type",
  DROP COLUMN IF EXISTS "return_identity_document_number",
  DROP COLUMN IF EXISTS "return_identity_matches_holder",
  DROP COLUMN IF EXISTS "return_identity_result",
  DROP COLUMN IF EXISTS "return_identity_verified_at",
  DROP COLUMN IF EXISTS "return_identity_verified_by";
