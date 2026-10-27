-- C5: Huella fisica tomada por contrato (no biometria)
ALTER TABLE "rental_contracts"
  ADD COLUMN "fingerprint_taken" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fingerprint_marked_by" TEXT,
  ADD COLUMN "fingerprint_marked_at" TIMESTAMP(3);
