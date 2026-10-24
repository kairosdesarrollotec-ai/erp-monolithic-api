ALTER TABLE "quotations" DROP COLUMN IF EXISTS "plan";
ALTER TABLE "inquiries" DROP COLUMN IF EXISTS "is_dirt_road";
ALTER TABLE "vehicles"
  DROP COLUMN IF EXISTS "suitable_for_trocha",
  DROP COLUMN IF EXISTS "rate_normal",
  DROP COLUMN IF EXISTS "rate_plus",
  DROP COLUMN IF EXISTS "rate_libre",
  DROP COLUMN IF EXISTS "fuel_penalty_per_line";
