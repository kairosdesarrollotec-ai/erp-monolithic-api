-- Bug-07: Add signature_data (base64 PNG) to rental_contracts.
-- TEXT column; nullable — existing contracts have no signature data.
ALTER TABLE "rental_contracts"
  ADD COLUMN IF NOT EXISTS "signature_data" TEXT;
