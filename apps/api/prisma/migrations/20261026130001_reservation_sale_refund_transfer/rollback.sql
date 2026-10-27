ALTER TABLE "reservation_resolutions"
  DROP COLUMN IF EXISTS "transfer_voucher",
  DROP COLUMN IF EXISTS "transferred_at",
  DROP COLUMN IF EXISTS "transferred_by";
