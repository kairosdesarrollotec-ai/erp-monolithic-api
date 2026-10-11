-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('PERIODO_PRUEBA', 'PLANILLA', 'TERMINADO');

-- CreateEnum
CREATE TYPE "TerminationReason" AS ENUM ('RENUNCIA', 'DESPIDO');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENTE', 'TARDANZA', 'FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA', 'PERMISO');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('PERMISO_HORAS', 'SALIDA_ANTES_DE_HORA', 'LICENCIA_MEDICA', 'PERSONAL');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('SOLICITADO', 'AUTORIZADO', 'DENEGADO');

-- CreateEnum
CREATE TYPE "VacationStatus" AS ENUM ('SOLICITADA', 'PROGRAMADA', 'REPROGRAMADA', 'CANCELADA', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "FieldTripStatus" AS ENUM ('PENDIENTE_NIVEL_1', 'PENDIENTE_NIVEL_2', 'PENDIENTE_NIVEL_3', 'AUTORIZADA', 'NO_AUTORIZADA', 'CERRADA_NORMAL', 'OBSERVADA');

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "candidate_id" TEXT,
    "document_type" VARCHAR(20) NOT NULL DEFAULT 'DNI',
    "document_number" VARCHAR(30) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(150),
    "phone" VARCHAR(50),
    "area_id" VARCHAR(100) NOT NULL,
    "area_name" VARCHAR(100) NOT NULL,
    "job_title" VARCHAR(150) NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'PERIODO_PRUEBA',
    "hire_date" DATE NOT NULL,
    "probation_evaluated_at" TIMESTAMP(3),
    "probation_passed" BOOLEAN,
    "payroll_started_at" TIMESTAMP(3),
    "terminated_at" TIMESTAMP(3),
    "termination_reason" "TerminationReason",
    "termination_notice_days" INTEGER,
    "termination_notes" TEXT,
    "field_trip_late_count" INTEGER NOT NULL DEFAULT 0,
    "is_field_trip_observed" BOOLEAN NOT NULL DEFAULT false,
    "base_salary" DECIMAL(10,2),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "check_in_time" TIMESTAMP(3),
    "check_out_time" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENTE',
    "minutes_late" INTEGER NOT NULL DEFAULT 0,
    "deduction_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_deduction_applied" BOOLEAN NOT NULL DEFAULT false,
    "payroll_month" VARCHAR(7),
    "deduction_applied_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'SOLICITADO',
    "authorized_by_id" TEXT,
    "authorized_by_name" VARCHAR(200),
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacation_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "area_id" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "VacationStatus" NOT NULL DEFAULT 'SOLICITADA',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_trip_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "destination" VARCHAR(255) NOT NULL,
    "objective" TEXT NOT NULL,
    "estimated_departure" TIMESTAMP(3) NOT NULL,
    "estimated_return" TIMESTAMP(3) NOT NULL,
    "actual_departure" TIMESTAMP(3),
    "actual_return" TIMESTAMP(3),
    "status" "FieldTripStatus" NOT NULL DEFAULT 'PENDIENTE_NIVEL_1',
    "authorization_level" INTEGER,
    "authorized_by_id" TEXT,
    "authorized_by_name" VARCHAR(200),
    "authorized_at" TIMESTAMP(3),
    "level1_timeout_at" TIMESTAMP(3),
    "level2_timeout_at" TIMESTAMP(3),
    "level3_timeout_at" TIMESTAMP(3),
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "return_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_trip_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "field_trip_level_max_3" CHECK ("authorization_level" IS NULL OR ("authorization_level" >= 1 AND "authorization_level" <= 3))
);

-- CreateTable
CREATE TABLE "employment_terminations" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "reason" "TerminationReason" NOT NULL,
    "notice_days" INTEGER NOT NULL DEFAULT 0,
    "final_settlement_paid" BOOLEAN NOT NULL DEFAULT false,
    "settlement_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terminated_by_id" TEXT NOT NULL,
    "terminated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_terminations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_document_key" ON "employees"("operating_company_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_candidate_id_key" ON "employees"("candidate_id");

-- CreateIndex
CREATE INDEX "employees_scope_status_idx" ON "employees"("organization_id", "operating_company_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "employees_area_status_idx" ON "employees"("area_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_date_key" ON "attendance_records"("employee_id", "date");

-- CreateIndex
CREATE INDEX "attendance_records_employee_payroll_month_idx" ON "attendance_records"("employee_id", "payroll_month");

-- CreateIndex
CREATE INDEX "attendance_records_date_status_idx" ON "attendance_records"("date", "status");

-- CreateIndex
CREATE INDEX "leave_requests_employee_date_idx" ON "leave_requests"("employee_id", "date");

-- CreateIndex
CREATE INDEX "leave_requests_status_date_idx" ON "leave_requests"("status", "date");

-- CreateIndex
CREATE INDEX "vacation_requests_area_status_dates_idx" ON "vacation_requests"("area_id", "status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "vacation_requests_employee_status_idx" ON "vacation_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "field_trips_employee_status_idx" ON "field_trip_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "field_trips_status_created_idx" ON "field_trip_requests"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "employment_terminations_employee_id_key" ON "employment_terminations"("employee_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_operating_company_id_fkey" FOREIGN KEY ("branch_id", "operating_company_id") REFERENCES "branches"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_trip_requests" ADD CONSTRAINT "field_trip_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_terminations" ADD CONSTRAINT "employment_terminations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
