-- rollback.sql — 20261008000001_vacation_requests_area_exclusion
-- Removes the EXCLUDE constraint for BR-ADP-002.
-- NOTE: btree_gist extension is NOT dropped here — it may be in use by other objects.
-- If confirmed unused, run manually: DROP EXTENSION IF EXISTS btree_gist;

ALTER TABLE "vacation_requests"
  DROP CONSTRAINT IF EXISTS "vacation_requests_area_no_overlap_excl";
