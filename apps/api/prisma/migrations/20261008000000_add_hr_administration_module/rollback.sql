-- rollback.sql — 20261008000000_add_hr_administration_module
-- Reverts the full HR-Administration module schema.
-- Run ONLY in dev/staging; never in production without a planificada rollback window.

ALTER TABLE "employment_terminations" DROP CONSTRAINT IF EXISTS "employment_terminations_employee_id_key";
DROP TABLE IF EXISTS "employment_terminations";
DROP TABLE IF EXISTS "field_trip_requests";
DROP TABLE IF EXISTS "vacation_requests";
DROP TABLE IF EXISTS "leave_requests";
DROP TABLE IF EXISTS "attendance_records";
DROP TABLE IF EXISTS "employees";

DROP TYPE IF EXISTS "FieldTripStatus";
DROP TYPE IF EXISTS "VacationStatus";
DROP TYPE IF EXISTS "LeaveStatus";
DROP TYPE IF EXISTS "LeaveType";
DROP TYPE IF EXISTS "AttendanceStatus";
DROP TYPE IF EXISTS "TerminationReason";
DROP TYPE IF EXISTS "EmployeeStatus";
