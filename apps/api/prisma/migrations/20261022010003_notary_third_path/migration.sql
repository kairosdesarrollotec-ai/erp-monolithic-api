-- DEC-ALQ-THIRDPATH-001 (22-oct-2026): tercera via notarial (BR-ALQ-004). Marca por vehiculo (solo Gerencia) y casilla
-- de biometrico registrada por el personal en la evaluacion notarial. Aditiva.
ALTER TABLE "vehicles" ADD COLUMN "third_path_eligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "notary_evaluations"
  ADD COLUMN "biometric_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "biometric_verified_by" TEXT,
  ADD COLUMN "previous_rentals_count" INTEGER;
