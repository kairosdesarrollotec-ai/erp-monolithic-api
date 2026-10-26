-- BR-ALQ-002 / HU-28 / SC-ALQ-001 (23-oct-2026): Registro minimo de gastos asumidos por la empresa (ej. gasto notarial).
CREATE TABLE "company_expenses" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "type" VARCHAR(40) NOT NULL DEFAULT 'GASTO_NOTARIAL',
  "amount" NUMERIC(10, 2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'PEN',
  "expense_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rental_id" TEXT,
  "vehicle_plate" VARCHAR(15),
  "reference" VARCHAR(100),
  "notes" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT NOT NULL,

  CONSTRAINT "company_expenses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "company_expenses"
  ADD CONSTRAINT "company_expenses_operating_company_id_organization_id_fkey"
  FOREIGN KEY ("operating_company_id", "organization_id")
  REFERENCES "companies"("id", "organization_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_expenses"
  ADD CONSTRAINT "company_expenses_rental_id_fkey"
  FOREIGN KEY ("rental_id")
  REFERENCES "rentals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "company_expenses_operating_company_id_type_expense_date_idx"
  ON "company_expenses"("operating_company_id", "type", "expense_date" DESC);
