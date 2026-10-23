-- Rollback de 20261022010003_notary_third_path (aplicar a mano). Se pierde la marca de vehiculo elegible y el registro del biometrico.
ALTER TABLE "notary_evaluations"
  DROP COLUMN IF EXISTS "biometric_verified",
  DROP COLUMN IF EXISTS "biometric_verified_by",
  DROP COLUMN IF EXISTS "previous_rentals_count";
ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "third_path_eligible";
