ALTER TABLE "rental_contracts"
  DROP COLUMN IF EXISTS "fingerprint_taken",
  DROP COLUMN IF EXISTS "fingerprint_marked_by",
  DROP COLUMN IF EXISTS "fingerprint_marked_at";
