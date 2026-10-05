-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM (
  'PROGRAMADA',
  'RECEPCION_PROVISIONAL',
  'INSPECCION',
  'SIN_DANOS',
  'CON_DANOS',
  'CIERRE_FINANCIERO',
  'CERRADA',
  'CANCELADA'
);

-- CreateEnum
CREATE TYPE "CustodyHolder" AS ENUM ('CLIENTE', 'VELOXRENT', 'TALLER');

-- CreateEnum
CREATE TYPE "DamageOrigin" AS ENUM ('AESTHETIC', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('LEVE', 'MODERADO', 'GRAVE');

-- CreateEnum
CREATE TYPE "ReturnFuelLevel" AS ENUM ('EMPTY', 'ONE_QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL');

-- CreateEnum
CREATE TYPE "ReturnEvidenceType" AS ENUM ('PHOTO', 'VIDEO');

-- CreateTable
CREATE TABLE "returns" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "rental_id" TEXT NOT NULL,
  "vehicle_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "status" "ReturnStatus" NOT NULL DEFAULT 'PROGRAMADA',
  "custody_holder" "CustodyHolder" NOT NULL DEFAULT 'CLIENTE',
  "customer_present" BOOLEAN NOT NULL DEFAULT true,
  "mileage_at_return" INTEGER,
  "fuel_level_at_return" "ReturnFuelLevel",
  "alcohol_test_result" "AlcoholTestResult",
  "alcohol_test_notes" TEXT,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "received_at" TIMESTAMP(3),
  "inspected_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "final_settlement_amount" DECIMAL(12,2),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "returns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "returns_rental_id_key" UNIQUE ("rental_id"),
  CONSTRAINT "returns_id_operating_company_id_key" UNIQUE ("id", "operating_company_id"),
  CONSTRAINT "return_custody_consistency" CHECK (
    ("status" = 'PROGRAMADA' AND "custody_holder" = 'CLIENTE') OR
    ("status" != 'PROGRAMADA' AND "custody_holder" IN ('VELOXRENT', 'TALLER')) OR
    "status" = 'CERRADA'
  )
);

-- CreateTable
CREATE TABLE "return_damages" (
  "id" TEXT NOT NULL,
  "return_id" TEXT NOT NULL,
  "origin" "DamageOrigin" NOT NULL,
  "severity" "DamageSeverity" NOT NULL,
  "damaged_zone" TEXT,
  "estimated_amount" DECIMAL(12,2),
  "external_report_reference" TEXT,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "return_damages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "damage_technical_needs_reference" CHECK (
    "origin" != 'TECHNICAL' OR "external_report_reference" IS NOT NULL
  )
);

-- CreateTable
CREATE TABLE "immobilization_charges" (
  "id" TEXT NOT NULL,
  "return_id" TEXT NOT NULL,
  "damage_id" TEXT,
  "days_charged" INTEGER NOT NULL,
  "daily_rate" DECIMAL(12,2) NOT NULL,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "immobilization_charges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "immobilization_days_positive" CHECK ("days_charged" > 0),
  CONSTRAINT "immobilization_amount_consistent" CHECK ("total_amount" = "days_charged" * "daily_rate")
);

-- CreateTable
CREATE TABLE "return_evidence" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL,
  "return_id" TEXT NOT NULL,
  "type" "ReturnEvidenceType" NOT NULL,
  "zone" TEXT NOT NULL,
  "object_url" TEXT NOT NULL,
  "uploaded_by" TEXT NOT NULL,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "return_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "returns_operating_company_id_status_created_at_idx" ON "returns"("operating_company_id", "status", "created_at" DESC);
CREATE INDEX "returns_organization_id_operating_company_id_branch_id_sta_idx" ON "returns"("organization_id", "operating_company_id", "branch_id", "status", "created_at" DESC);
CREATE INDEX "returns_rental_id_idx" ON "returns"("rental_id");

-- CreateIndex
CREATE INDEX "return_damages_return_id_idx" ON "return_damages"("return_id");

-- CreateIndex
CREATE INDEX "immobilization_charges_return_id_idx" ON "immobilization_charges"("return_id");

-- CreateIndex
CREATE INDEX "return_evidence_return_id_type_idx" ON "return_evidence"("return_id", "type");
CREATE INDEX "return_evidence_organization_id_operating_company_id_retu_idx" ON "return_evidence"("organization_id", "operating_company_id", "return_id");

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_branch_id_operating_company_id_fkey" FOREIGN KEY ("branch_id", "operating_company_id") REFERENCES "branches"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_vehicle_id_operating_company_id_fkey" FOREIGN KEY ("vehicle_id", "operating_company_id") REFERENCES "vehicles"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_operating_company_id_fkey" FOREIGN KEY ("customer_id", "operating_company_id") REFERENCES "customers"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_damages" ADD CONSTRAINT "return_damages_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immobilization_charges" ADD CONSTRAINT "immobilization_charges_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "immobilization_charges" ADD CONSTRAINT "immobilization_charges_damage_id_fkey" FOREIGN KEY ("damage_id") REFERENCES "return_damages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_evidence" ADD CONSTRAINT "return_evidence_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
