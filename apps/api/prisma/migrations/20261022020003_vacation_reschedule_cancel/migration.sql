-- 22-oct-2026 (Respuestas Russbel #10): vacaciones en conflicto -> REPROGRAMAR a otra fecha libre (sin lista de espera) o CANCELAR.
-- Escrita A MANO, ADITIVA. Los estados REPROGRAMADA / CANCELADA ya existen en el enum VacationStatus (y REPROGRAMADA ya ocupa cupo en la
-- EXCLUDE por empresa+area+fechas); aqui solo se agregan columnas para conservar las fechas originales y la auditoria del cambio.
ALTER TABLE "vacation_requests"
  ADD COLUMN "original_start_date" DATE,
  ADD COLUMN "original_end_date" DATE,
  ADD COLUMN "reschedule_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "status_reason" TEXT,
  ADD COLUMN "status_changed_at" TIMESTAMP(3),
  ADD COLUMN "status_changed_by_id" TEXT;
