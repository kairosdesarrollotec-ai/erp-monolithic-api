-- Bug-08: Add deposit_minimum to vehicles table.
-- Nullable field: no default needed, existing rows keep NULL (no minimum configured).
ALTER TABLE "vehicles"
  ADD COLUMN IF NOT EXISTS "deposit_minimum" DECIMAL(10,2);
