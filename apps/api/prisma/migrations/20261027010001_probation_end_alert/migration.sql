-- HU-33: Alerta de fin de periodo de prueba (15 días antes de cumplir los 3 meses) enviada a Gerencia General
ALTER TABLE "employee_onboardings" ADD COLUMN IF NOT EXISTS "probation_alert_sent_at" TIMESTAMP(3);
