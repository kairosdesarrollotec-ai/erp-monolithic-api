-- Rollback: 20261023080001_vacation_granted_days

ALTER TABLE "vacation_requests" DROP COLUMN IF EXISTS "granted_days";
