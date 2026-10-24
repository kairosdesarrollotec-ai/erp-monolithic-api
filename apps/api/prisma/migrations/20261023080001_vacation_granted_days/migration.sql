-- Migration: 20261023080001_vacation_granted_days
-- R4: Soporte para otorgar menos días de los solicitados por Gerencia (granted_days)

ALTER TABLE "vacation_requests" ADD COLUMN IF NOT EXISTS "granted_days" INTEGER;
