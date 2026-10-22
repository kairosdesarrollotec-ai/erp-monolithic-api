-- Rollback de 20261022030001: quita la exclusion de rango de vehicle_commitments. No se elimina la extension btree_gist
-- (la usan otras constraints, p. ej. vacation_requests_area_no_overlap_excl).
ALTER TABLE "vehicle_commitments" DROP CONSTRAINT IF EXISTS "vehicle_commitments_no_overlap_excl";
