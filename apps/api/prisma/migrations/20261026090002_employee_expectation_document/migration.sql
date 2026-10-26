-- B6: REC-P13 - Documento de expectativas del colaborador (a los 2 días de ingreso)
CREATE TABLE "employee_expectation_documents" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "employee_id" TEXT NOT NULL UNIQUE REFERENCES "employees"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "deadline_date" DATE NOT NULL,
  "file_url" VARCHAR(500),
  "signed_at" TIMESTAMPTZ,
  "registered_by" VARCHAR(128) NOT NULL,
  "signed_registered_by" VARCHAR(128),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_emp_expectations_status_deadline"
  ON "employee_expectation_documents" ("status", "deadline_date");
