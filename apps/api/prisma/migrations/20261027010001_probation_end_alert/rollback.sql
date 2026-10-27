-- Rollback HU-33: Alerta de fin de periodo de prueba
ALTER TABLE "employee_onboardings" DROP COLUMN IF EXISTS "probation_alert_sent_at";
