-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM (
  'DRAFT',
  'VALIDATION',
  'NOTARY_EVALUATION',
  'CONTRACTING',
  'PENDING_DELIVERY',
  'ACTIVE',
  'EXTENSION_PENDING',
  'RETURN_IN_PROGRESS',
  'CLOSED',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "AlcoholTestResult" AS ENUM ('FAVORABLE', 'DESFAVORABLE', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "NotaryResult" AS ENUM ('MANDATORY', 'DOUBLE_DEPOSIT', 'THIRD_PATH_ELIGIBLE', 'MANUAL_REVIEW');

-- CreateTable
CREATE TABLE "rentals" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "inquiry_id" TEXT,
  "reservation_id" TEXT,
  "customer_id" TEXT NOT NULL,
  "vehicle_id" TEXT NOT NULL,
  "plan_code" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" "RentalStatus" NOT NULL DEFAULT 'DRAFT',
  "start_at" TIMESTAMP(3),
  "expected_end_at" TIMESTAMP(3),
  "alcohol_test_result" "AlcoholTestResult",
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "rentals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rental_period_check" CHECK ("expected_end_at" IS NULL OR "start_at" IS NULL OR "start_at" < "expected_end_at")
);

-- CreateTable
CREATE TABLE "rental_parties" (
  "id" TEXT NOT NULL,
  "rental_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rental_parties_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rental_party_role_check" CHECK ("role" IN ('SIGNER', 'DRIVER', 'RESPONSIBLE'))
);

-- CreateTable
CREATE TABLE "notary_evaluations" (
  "id" TEXT NOT NULL,
  "rental_id" TEXT NOT NULL,
  "policy_version" INTEGER NOT NULL,
  "result" "NotaryResult" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_by" TEXT,
  "justification" VARCHAR(500),

  CONSTRAINT "notary_evaluations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notary_exception_approval_check" CHECK (
    "result" != 'THIRD_PATH_ELIGIBLE' OR "approved_by" IS NOT NULL
  )
);

-- CreateTable
CREATE TABLE "rental_contracts" (
  "id" TEXT NOT NULL,
  "rental_id" TEXT NOT NULL,
  "template_version_id" TEXT NOT NULL,
  "document_ref" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "signed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rental_contracts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rental_contract_status_check" CHECK ("status" IN ('PENDING', 'SIGNED', 'VOID'))
);

-- CreateTable
CREATE TABLE "contract_templates" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "type" VARCHAR(30) NOT NULL,
  "version" INTEGER NOT NULL,
  "effective_from" TIMESTAMP(3) NOT NULL,
  "effective_to" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_template_status_check" CHECK ("status" IN ('ACTIVE', 'RETIRED'))
);

-- CreateTable
CREATE TABLE "rental_deposits" (
  "id" TEXT NOT NULL,
  "rental_id" TEXT NOT NULL,
  "original_amount" DECIMAL(12,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'HELD',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rental_deposits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rental_deposit_status_check" CHECK ("status" IN ('HELD', 'RETURNED', 'RETAINED', 'PARTIALLY_RETAINED'))
);

-- CreateTable
CREATE TABLE "rental_deposit_adjustments" (
  "id" TEXT NOT NULL,
  "deposit_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "authorized_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rental_deposit_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rental_deposit_adj_type_check" CHECK ("type" IN ('DISCOUNT', 'FULL_RETENTION', 'RELEASE', 'IMMOBILIZATION_CHARGE'))
);

-- CreateTable
CREATE TABLE "rental_extensions" (
  "id" TEXT NOT NULL,
  "rental_id" TEXT NOT NULL,
  "requested_end_at" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "payment_id" TEXT,
  "addendum_document_ref" TEXT,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),

  CONSTRAINT "rental_extensions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rental_extension_status_check" CHECK ("status" IN ('PENDING', 'AUTHORIZED', 'REJECTED', 'BREACH'))
);

-- CreateIndex
CREATE UNIQUE INDEX "rentals_reservation_id_key" ON "rentals"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "rentals_id_operating_company_id_key" ON "rentals"("id", "operating_company_id");

-- CreateIndex
CREATE INDEX "rentals_operating_company_id_status_created_at_idx" ON "rentals"("operating_company_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "rentals_organization_id_operating_company_id_branch_id_stat_idx" ON "rentals"("organization_id", "operating_company_id", "branch_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "rentals_customer_id_created_at_idx" ON "rentals"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "rental_parties_rental_id_idx" ON "rental_parties"("rental_id");

-- CreateIndex
CREATE UNIQUE INDEX "notary_evaluations_rental_id_key" ON "notary_evaluations"("rental_id");

-- CreateIndex
CREATE UNIQUE INDEX "rental_contracts_rental_id_key" ON "rental_contracts"("rental_id");

-- CreateIndex
CREATE INDEX "contract_templates_company_id_type_idx" ON "contract_templates"("company_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "contract_templates_company_id_type_version_key" ON "contract_templates"("company_id", "type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "rental_deposits_rental_id_key" ON "rental_deposits"("rental_id");

-- CreateIndex
CREATE INDEX "rental_deposit_adjustments_deposit_id_idx" ON "rental_deposit_adjustments"("deposit_id");

-- CreateIndex
CREATE INDEX "rental_extensions_rental_id_idx" ON "rental_extensions"("rental_id");

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_branch_id_operating_company_id_fkey" FOREIGN KEY ("branch_id", "operating_company_id") REFERENCES "branches"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_customer_id_operating_company_id_fkey" FOREIGN KEY ("customer_id", "operating_company_id") REFERENCES "customers"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_vehicle_id_operating_company_id_fkey" FOREIGN KEY ("vehicle_id", "operating_company_id") REFERENCES "vehicles"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_parties" ADD CONSTRAINT "rental_parties_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_parties" ADD CONSTRAINT "rental_parties_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notary_evaluations" ADD CONSTRAINT "notary_evaluations_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "contract_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_deposits" ADD CONSTRAINT "rental_deposits_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_deposit_adjustments" ADD CONSTRAINT "rental_deposit_adjustments_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "rental_deposits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_extensions" ADD CONSTRAINT "rental_extensions_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
