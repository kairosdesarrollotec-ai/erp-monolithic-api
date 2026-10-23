-- DAT-RES-001 / BR-RES-005 (23-oct-2026): persistir ubicacion del cliente y canComeToOffice en Reservation.
-- Aditiva: columnas nullable, seguro con filas existentes.
DO $$ BEGIN
  CREATE TYPE "CustomerLocation" AS ENUM ('AYACUCHO', 'FUERA_DE_AYACUCHO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "reservations"
  ADD COLUMN "can_come_to_office" BOOLEAN,
  ADD COLUMN "customer_location" "CustomerLocation";
