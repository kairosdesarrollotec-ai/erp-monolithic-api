-- DEC-ALQ-UNAUTH-DRIVER-003: nuevo tipo de incidencia (conductor no autorizado; decide Gerencia caso por caso).
ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'UNAUTHORIZED_DRIVER';

-- DEC-ALQ-COMPANY-DRIVER-004: con conductor de la empresa NO hay garantia (Ficha AS-IS 5-ago).
-- `deposit_required` = false => no existe fila en rental_deposits; el credito de reserva pagado (si lo hay)
-- se registra completo como saldo a favor en `reservation_credit_excess` (sin reembolso automatico).
ALTER TABLE "rental_contracts" ADD COLUMN "deposit_required" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "rental_contracts" ADD COLUMN "reservation_credit_excess" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- DEC-ALQ-OWN-DRIVER-005: conductor autorizado de persona juridica -> referencia a la adenda firmada.
ALTER TABLE "rental_parties" ADD COLUMN "addendum_document_ref" VARCHAR(200);
